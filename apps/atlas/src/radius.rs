use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use crate::radius_db;

#[derive(Debug, Serialize, FromRow)]
pub struct Nas {
    pub id: i64,
    pub nasname: String,
    pub shortname: Option<String>,
    pub nas_type: Option<String>,
    pub ports: Option<i32>,
    pub description: Option<String>,
    pub secret_configured: bool,
}

#[derive(Debug, Deserialize)]
pub struct NasWriteRequest {
    pub nasname: String,
    pub shortname: Option<String>,
    #[serde(default = "default_nas_type")]
    pub nas_type: String,
    pub ports: Option<i32>,
    pub secret: String,
    pub description: Option<String>,
}

fn default_nas_type() -> String {
    "other".to_string()
}

#[derive(Debug, Serialize, FromRow)]
pub struct Subscriber {
    pub username: String,
}

#[derive(Debug, Deserialize)]
pub struct SubscriberWriteRequest {
    pub username: String,
    pub password: String,
    pub groupname: Option<String>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct ActiveSession {
    pub acctsessionid: String,
    pub username: String,
    pub nasipaddress: String,
    pub framedipaddress: String,
    pub acctstarttime: Option<String>,
    pub acctsessiontime: Option<i64>,
    pub acctinputoctets: Option<i64>,
    pub acctoutputoctets: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct AccountingSummary {
    pub total_sessions: i64,
    pub active_sessions: i64,
    pub input_octets: i64,
    pub output_octets: i64,
}

pub fn validate_nas(input: &NasWriteRequest) -> Result<(), &'static str> {
    if input.nasname.trim().is_empty() || input.nasname.len() > 128 {
        return Err("nasname must contain 1 to 128 characters");
    }
    let valid_ip = input.nasname.parse::<std::net::IpAddr>().is_ok()
        || input.nasname.parse::<ipnet::IpNet>().is_ok();
    if !valid_ip {
        return Err("nasname must be an IPv4/IPv6 address or CIDR network");
    }
    if input.shortname.as_ref().is_some_and(|value| value.len() > 32) {
        return Err("shortname must not exceed 32 characters");
    }
    if input.nas_type.trim().is_empty() || input.nas_type.len() > 30 {
        return Err("nas_type must contain 1 to 30 characters");
    }
    if input.secret.len() < 32
        || input.secret.len() > 60
        || !input.secret.bytes().all(|byte| (0x21..=0x7e).contains(&byte))
    {
        return Err("NAS shared secret must be 32-60 printable non-space ASCII characters");
    }
    if input.description.as_ref().is_some_and(|value| value.len() > 200) {
        return Err("description must not exceed 200 characters");
    }
    Ok(())
}

pub fn validate_subscriber(input: &SubscriberWriteRequest) -> Result<(), &'static str> {
    if input.username.trim().is_empty()
        || input.username.len() > 64
        || input.username.chars().any(char::is_control)
    {
        return Err("username must contain 1 to 64 non-control characters");
    }
    if input.password.len() < 12
        || input.password.len() > 253
        || input.password.chars().any(char::is_control)
    {
        return Err("subscriber password must contain 12 to 253 non-control characters");
    }
    if input
        .groupname
        .as_ref()
        .is_some_and(|value| value.trim().is_empty() || value.len() > 64)
    {
        return Err("groupname must contain 1 to 64 characters");
    }
    Ok(())
}

pub async fn list_nas() -> Result<Vec<Nas>, sqlx::Error> {
    sqlx::query_as::<_, Nas>(
        "SELECT id, nasname, shortname, `type` AS nas_type, ports, description, (secret <> '') AS secret_configured FROM nas ORDER BY nasname",
    )
    .fetch_all(radius_db::pool().await?)
    .await
}

pub async fn create_nas(input: &NasWriteRequest) -> Result<Nas, sqlx::Error> {
    let pool = radius_db::pool().await?;
    let mut tx = pool.begin().await?;
    sqlx::query("INSERT INTO nas (nasname, shortname, `type`, ports, secret, description) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(input.nasname.trim())
        .bind(input.shortname.as_deref())
        .bind(input.nas_type.trim())
        .bind(input.ports)
        .bind(&input.secret)
        .bind(input.description.as_deref())
        .execute(&mut *tx)
        .await?;
    let id: i64 = sqlx::query_scalar("SELECT LAST_INSERT_ID()")
        .fetch_one(&mut *tx)
        .await?;
    tx.commit().await?;
    get_nas(id).await?.ok_or(sqlx::Error::RowNotFound)
}

pub async fn get_nas(id: i64) -> Result<Option<Nas>, sqlx::Error> {
    sqlx::query_as::<_, Nas>(
        "SELECT id, nasname, shortname, `type` AS nas_type, ports, description, (secret <> '') AS secret_configured FROM nas WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(radius_db::pool().await?)
    .await
}

pub async fn delete_nas(id: i64) -> Result<bool, sqlx::Error> {
    let result = sqlx::query("DELETE FROM nas WHERE id = ?")
        .bind(id)
        .execute(radius_db::pool().await?)
        .await?;
    Ok(result.rows_affected() > 0)
}

pub async fn list_subscribers() -> Result<Vec<Subscriber>, sqlx::Error> {
    sqlx::query_as::<_, Subscriber>("SELECT DISTINCT username FROM radcheck ORDER BY username")
        .fetch_all(radius_db::pool().await?)
        .await
}

pub async fn create_or_update_subscriber(
    input: &SubscriberWriteRequest,
) -> Result<(), sqlx::Error> {
    let pool = radius_db::pool().await?;
    let mut tx = pool.begin().await?;
    sqlx::query("DELETE FROM radcheck WHERE username = ? AND attribute = 'Cleartext-Password'")
        .bind(input.username.trim())
        .execute(&mut *tx)
        .await?;
    sqlx::query("INSERT INTO radcheck (username, attribute, op, value) VALUES (?, 'Cleartext-Password', ':=', ?)")
        .bind(input.username.trim())
        .bind(&input.password)
        .execute(&mut *tx)
        .await?;
    sqlx::query("DELETE FROM radusergroup WHERE username = ?")
        .bind(input.username.trim())
        .execute(&mut *tx)
        .await?;
    if let Some(group) = input.groupname.as_deref() {
        sqlx::query("INSERT INTO radusergroup (username, groupname, priority) VALUES (?, ?, 1)")
            .bind(input.username.trim())
            .bind(group.trim())
            .execute(&mut *tx)
            .await?;
    }
    tx.commit().await
}

pub async fn delete_subscriber(username: &str) -> Result<bool, sqlx::Error> {
    let pool = radius_db::pool().await?;
    let mut tx = pool.begin().await?;
    let mut changed = 0;
    for table in ["radcheck", "radreply", "radusergroup"] {
        let query = format!("DELETE FROM {table} WHERE username = ?");
        changed += sqlx::query(&query)
            .bind(username)
            .execute(&mut *tx)
            .await?
            .rows_affected();
    }
    tx.commit().await?;
    Ok(changed > 0)
}

pub async fn active_sessions() -> Result<Vec<ActiveSession>, sqlx::Error> {
    sqlx::query_as::<_, ActiveSession>(
        "SELECT acctsessionid, username, nasipaddress, framedipaddress, CAST(acctstarttime AS CHAR) AS acctstarttime, acctsessiontime, acctinputoctets, acctoutputoctets FROM radacct WHERE acctstoptime IS NULL ORDER BY acctstarttime DESC LIMIT 500",
    )
    .fetch_all(radius_db::pool().await?)
    .await
}

pub async fn accounting_summary() -> Result<AccountingSummary, sqlx::Error> {
    let pool = radius_db::pool().await?;
    let (total_sessions, active_sessions, input_octets, output_octets) =
        sqlx::query_as::<_, (i64, i64, i64, i64)>(
            "SELECT COUNT(*), SUM(CASE WHEN acctstoptime IS NULL THEN 1 ELSE 0 END), CAST(COALESCE(SUM(acctinputoctets), 0) AS SIGNED), CAST(COALESCE(SUM(acctoutputoctets), 0) AS SIGNED) FROM radacct",
        )
        .fetch_one(pool)
        .await?;
    Ok(AccountingSummary {
        total_sessions,
        active_sessions,
        input_octets,
        output_octets,
    })
}
