pub const DEFAULT_DB_MAX_CONNECTIONS: u32 = 10;
pub const MAX_DB_CONNECTIONS: u32 = 1000;

pub fn parse_db_max_connections(value: Option<&str>) -> Result<u32, &'static str> {
    let Some(value) = value else {
        return Ok(DEFAULT_DB_MAX_CONNECTIONS);
    };

    let parsed = value
        .parse::<u32>()
        .map_err(|_| "DB_MAX_CONNECTIONS must be a positive integer")?;

    if !(1..=MAX_DB_CONNECTIONS).contains(&parsed) {
        return Err("DB_MAX_CONNECTIONS must be between 1 and 1000");
    }

    Ok(parsed)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_pool_size_when_unset() {
        assert_eq!(parse_db_max_connections(None), Ok(10));
    }

    #[test]
    fn accepts_valid_pool_size() {
        assert_eq!(parse_db_max_connections(Some("32")), Ok(32));
    }

    #[test]
    fn rejects_zero_and_out_of_range_pool_sizes() {
        assert!(parse_db_max_connections(Some("0")).is_err());
        assert!(parse_db_max_connections(Some("1001")).is_err());
    }

    #[test]
    fn rejects_non_numeric_pool_size() {
        assert!(parse_db_max_connections(Some("many")).is_err());
    }
}
