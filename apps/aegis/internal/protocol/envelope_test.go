package protocol

import (
	"encoding/json"
	"strings"
	"testing"
	"time"
)

func validEnvelope(now time.Time) Envelope {
	return Envelope{
		Version: VersionV1, RequestID: "req-123", IdempotencyKey: "idem-123",
		Operation: "inventory.read", TargetID: "router-01",
		IssuedAt: now.Add(-time.Second), ExpiresAt: now.Add(30 * time.Second),
		Payload: json.RawMessage(`{"scope":"summary"}`),
	}
}

func validator(now time.Time) Validator {
	return Validator{
		AllowedOperations: map[string]struct{}{"inventory.read": {}},
		MaxTTL:            2 * time.Minute, ClockSkew: 5 * time.Second,
		Now: func() time.Time { return now },
	}
}

func TestValidateAcceptsExplicitlyAllowedEnvelope(t *testing.T) {
	now := time.Date(2026, 11, 9, 0, 0, 0, 0, time.UTC)
	if err := validator(now).Validate(validEnvelope(now)); err != nil {
		t.Fatalf("Validate() error = %v", err)
	}
}

func TestValidateDeniesUnknownOperationByDefault(t *testing.T) {
	now := time.Date(2026, 11, 9, 0, 0, 0, 0, time.UTC)
	v := validator(now)
	v.AllowedOperations = map[string]struct{}{}
	err := v.Validate(validEnvelope(now))
	if err == nil || !strings.Contains(err.Error(), "allowlisted") {
		t.Fatalf("Validate() error = %v, want allowlist denial", err)
	}
}

func TestValidateRejectsExpiredEnvelope(t *testing.T) {
	now := time.Date(2026, 11, 9, 0, 0, 0, 0, time.UTC)
	e := validEnvelope(now)
	e.ExpiresAt = now
	if err := validator(now).Validate(e); err == nil {
		t.Fatal("expected expired envelope to be rejected")
	}
}

func TestValidateRejectsExcessiveTTL(t *testing.T) {
	now := time.Date(2026, 11, 9, 0, 0, 0, 0, time.UTC)
	e := validEnvelope(now)
	e.ExpiresAt = e.IssuedAt.Add(3 * time.Minute)
	if err := validator(now).Validate(e); err == nil {
		t.Fatal("expected excessive TTL to be rejected")
	}
}

func TestValidateRejectsMalformedPayload(t *testing.T) {
	now := time.Date(2026, 11, 9, 0, 0, 0, 0, time.UTC)
	e := validEnvelope(now)
	e.Payload = json.RawMessage(`["not","an","object"]`)
	if err := validator(now).Validate(e); err == nil {
		t.Fatal("expected non-object payload to be rejected")
	}
}

func TestValidateRequiresConfiguredMaxTTL(t *testing.T) {
	now := time.Date(2026, 11, 9, 0, 0, 0, 0, time.UTC)
	v := validator(now)
	v.MaxTTL = 0
	if err := v.Validate(validEnvelope(now)); err == nil {
		t.Fatal("expected missing MaxTTL to be rejected")
	}
}
