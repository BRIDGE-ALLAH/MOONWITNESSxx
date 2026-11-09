package protocol

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"regexp"
	"time"
)

const VersionV1 = "v1"

const MaxEnvelopeBytes = 128 * 1024

var identifierPattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$`)

type Envelope struct {
	Version        string          `json:"version"`
	RequestID      string          `json:"request_id"`
	IdempotencyKey string          `json:"idempotency_key"`
	Operation      string          `json:"operation"`
	TargetID       string          `json:"target_id"`
	IssuedAt       time.Time       `json:"issued_at"`
	ExpiresAt      time.Time       `json:"expires_at"`
	Payload        json.RawMessage `json:"payload"`
}

type Validator struct {
	AllowedOperations map[string]struct{}
	MaxTTL            time.Duration
	MaxPayloadBytes   int
	ClockSkew         time.Duration
	Now               func() time.Time
}

// DecodeEnvelope rejects oversized documents, unknown fields, and trailing JSON values.
func DecodeEnvelope(data []byte) (Envelope, error) {
	if len(data) == 0 || len(data) > MaxEnvelopeBytes {
		return Envelope{}, errors.New("command envelope is empty or exceeds the maximum size")
	}
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()

	var envelope Envelope
	if err := decoder.Decode(&envelope); err != nil {
		return Envelope{}, fmt.Errorf("decode command envelope: %w", err)
	}
	var trailing any
	if err := decoder.Decode(&trailing); err != io.EOF {
		return Envelope{}, errors.New("command envelope must contain exactly one JSON object")
	}
	return envelope, nil
}

func (v Validator) Validate(e Envelope) error {
	if e.Version != VersionV1 {
		return errors.New("unsupported protocol version")
	}
	for name, value := range map[string]string{
		"request_id": e.RequestID, "idempotency_key": e.IdempotencyKey,
		"operation": e.Operation, "target_id": e.TargetID,
	} {
		if !identifierPattern.MatchString(value) {
			return fmt.Errorf("%s is missing or has invalid characters", name)
		}
	}
	if v.MaxPayloadBytes <= 0 {
		return errors.New("validator MaxPayloadBytes must be configured")
	}
	if len(e.Payload) == 0 || len(e.Payload) > v.MaxPayloadBytes || !json.Valid(e.Payload) || !bytes.HasPrefix(bytes.TrimSpace(e.Payload), []byte("{")) {
		return errors.New("payload must be a valid JSON object")
	}
	if e.IssuedAt.IsZero() || e.ExpiresAt.IsZero() || !e.ExpiresAt.After(e.IssuedAt) {
		return errors.New("issued_at and expires_at must define a positive validity window")
	}
	if v.MaxTTL <= 0 {
		return errors.New("validator MaxTTL must be configured")
	}
	if e.ExpiresAt.Sub(e.IssuedAt) > v.MaxTTL {
		return errors.New("command validity window exceeds maximum TTL")
	}
	now := time.Now().UTC()
	if v.Now != nil {
		now = v.Now().UTC()
	}
	skew := v.ClockSkew
	if skew < 0 {
		return errors.New("validator ClockSkew cannot be negative")
	}
	if e.IssuedAt.After(now.Add(skew)) {
		return errors.New("command was issued in the future")
	}
	if !e.ExpiresAt.After(now) {
		return errors.New("command has expired")
	}
	if _, ok := v.AllowedOperations[e.Operation]; !ok {
		return errors.New("operation is not explicitly allowlisted")
	}
	return nil
}
