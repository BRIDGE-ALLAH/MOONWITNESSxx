use std::env;

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::engine::EngineInstance;

pub struct PowerDnsClient {
    client: reqwest::Client,
    base_url: String,
    api_key: String,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ZoneCreateRequest {
    pub name: String,
    #[serde(default = "default_zone_kind")]
    pub kind: String,
    pub nameservers: Vec<String>,
    #[serde(default)]
    pub masters: Vec<String>,
}

fn default_zone_kind() -> String {
    "Native".to_string()
}

#[derive(Debug, Deserialize, Serialize)]
pub struct RrRecord {
    pub content: String,
    #[serde(default)]
    pub disabled: bool,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct RrsetWrite {
    pub name: String,
    #[serde(rename = "type")]
    pub record_type: String,
    pub ttl: Option<u32>,
    pub changetype: String,
    #[serde(default)]
    pub records: Vec<RrRecord>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct RrsetPatchRequest {
    pub rrsets: Vec<RrsetWrite>,
}

impl PowerDnsClient {
    pub fn new(engine: &EngineInstance) -> Result<Self, &'static str> {
        if engine.engine_type != "powerdns-authoritative" {
            return Err("engine instance is not PowerDNS Authoritative");
        }
        if !engine.enabled {
            return Err("PowerDNS engine instance is disabled");
        }
        let Some(secret_key) = engine.secret_env_key.as_ref() else {
            return Err("PowerDNS API secret reference is not configured");
        };
        let api_key = env::var(secret_key).map_err(|_| "PowerDNS API secret is unavailable")?;
        let base_url = engine.endpoint.trim_end_matches('/').to_string();
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .map_err(|_| "could not initialize PowerDNS HTTP client")?;
        Ok(Self {
            client,
            base_url,
            api_key,
        })
    }

    fn zone_url(&self, zone: &str) -> String {
        format!(
            "{}/api/v1/servers/localhost/zones/{}",
            self.base_url, zone
        )
    }

    fn zones_url(&self) -> String {
        format!("{}/api/v1/servers/localhost/zones?dnssec=false", self.base_url)
    }

    pub async fn list_zones(&self) -> Result<Value, reqwest::Error> {
        self.client
            .get(self.zones_url())
            .header("X-API-Key", &self.api_key)
            .send()
            .await?
            .error_for_status()?
            .json()
            .await
    }

    pub async fn get_zone(&self, zone: &str) -> Result<Value, reqwest::Error> {
        self.client
            .get(self.zone_url(zone))
            .header("X-API-Key", &self.api_key)
            .send()
            .await?
            .error_for_status()?
            .json()
            .await
    }

    pub async fn create_zone(&self, input: &ZoneCreateRequest) -> Result<Value, reqwest::Error> {
        self.client
            .post(format!("{}/api/v1/servers/localhost/zones", self.base_url))
            .header("X-API-Key", &self.api_key)
            .json(input)
            .send()
            .await?
            .error_for_status()?
            .json()
            .await
    }

    pub async fn delete_zone(&self, zone: &str) -> Result<(), reqwest::Error> {
        self.client
            .delete(self.zone_url(zone))
            .header("X-API-Key", &self.api_key)
            .send()
            .await?
            .error_for_status()?;
        Ok(())
    }

    pub async fn patch_rrsets(
        &self,
        zone: &str,
        input: &RrsetPatchRequest,
    ) -> Result<(), reqwest::Error> {
        self.client
            .patch(self.zone_url(zone))
            .header("X-API-Key", &self.api_key)
            .json(input)
            .send()
            .await?
            .error_for_status()?;
        Ok(())
    }
}

pub fn validate_zone_name(name: &str) -> Result<(), &'static str> {
    if name.len() < 3 || name.len() > 254 || !name.ends_with('.') {
        return Err("zone name must be a fully-qualified DNS name ending with a dot");
    }
    let labels = name.trim_end_matches('.').split('.');
    for label in labels {
        if label.is_empty()
            || label.len() > 63
            || label.starts_with('-')
            || label.ends_with('-')
            || !label
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
        {
            return Err("zone name contains an invalid DNS label");
        }
    }
    Ok(())
}

pub fn validate_zone(input: &ZoneCreateRequest) -> Result<(), &'static str> {
    validate_zone_name(&input.name)?;
    if !matches!(input.kind.as_str(), "Native" | "Master" | "Slave") {
        return Err("zone kind must be Native, Master, or Slave");
    }
    if input.nameservers.len() < 2 || input.nameservers.len() > 8 {
        return Err("zone requires between 2 and 8 nameservers");
    }
    for nameserver in &input.nameservers {
        validate_zone_name(nameserver)?;
    }
    if input.kind == "Slave" && input.masters.is_empty() {
        return Err("slave zones require at least one master server");
    }
    if input.masters.len() > 8 {
        return Err("a zone may define at most 8 master servers");
    }
    Ok(())
}

fn validate_rrset_name(name: &str) -> Result<(), &'static str> {
    if name.len() < 3 || name.len() > 254 || !name.ends_with('.') {
        return Err("RRset name must be a fully-qualified DNS name ending with a dot");
    }
    for label in name.trim_end_matches('.').split('.') {
        if label.is_empty()
            || label.len() > 63
            || !label
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
        {
            return Err("RRset name contains an invalid DNS label");
        }
    }
    Ok(())
}

pub fn validate_rrsets(zone: &str, input: &RrsetPatchRequest) -> Result<(), &'static str> {
    validate_zone_name(zone)?;
    if input.rrsets.is_empty() || input.rrsets.len() > 100 {
        return Err("request must contain between 1 and 100 RRsets");
    }
    let allowed_types = [
        "A", "AAAA", "CAA", "CNAME", "DNSKEY", "DS", "HTTPS", "LOC", "MX", "NAPTR",
        "NS", "PTR", "SRV", "SSHFP", "SVCB", "TLSA", "TXT",
    ];
    for rrset in &input.rrsets {
        validate_rrset_name(&rrset.name)?;
        if rrset.name != zone && !rrset.name.ends_with(&format!(".{zone}")) {
            return Err("RRset name must be inside the target zone");
        }
        if !allowed_types.contains(&rrset.record_type.as_str()) {
            return Err("RRset type is not supported by this API");
        }
        if !matches!(
            rrset.changetype.as_str(),
            "REPLACE" | "DELETE" | "EXTEND" | "PRUNE"
        ) {
            return Err("RRset changetype must be REPLACE, DELETE, EXTEND, or PRUNE");
        }
        if rrset.changetype != "DELETE" && rrset.records.is_empty() {
            return Err("non-delete RRsets require at least one record");
        }
        if rrset.records.len() > 100 {
            return Err("an RRset may contain at most 100 records");
        }
        if rrset.ttl.is_some_and(|ttl| !(30..=86400).contains(&ttl)) {
            return Err("RRset TTL must be between 30 and 86400 seconds");
        }
        if rrset.records.iter().any(|record| {
            record.content.trim().is_empty()
                || record.content.len() > 4096
                || record.content.chars().any(char::is_control)
        }) {
            return Err("record content is empty, too long, or contains control characters");
        }
    }
    Ok(())
}
