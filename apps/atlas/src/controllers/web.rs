use axum::response::Html;
use loco_rs::prelude::*;

async fn dashboard() -> Html<&'static str> {
    Html(include_str!("../../assets/dashboard.html"))
}

pub fn routes() -> Routes {
    Routes::new()
        .add("/", get(dashboard))
        .add("/dashboard", get(dashboard))
}
