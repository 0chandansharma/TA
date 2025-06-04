package services

import (
	"ai-bot-deecogs/internal/db"
	"context"
	"errors"
	"time"
)

type PhysioCall struct {
	CallID        string     `json:"call_id"`
	AssessmentID  string     `json:"assessment_id"`
	CallType      string     `json:"call_type"`       // Immediate or Scheduled
	CallStatus    string     `json:"call_status"`     // Scheduled, Completed, Cancelled
	ScheduledTime *time.Time `json:"scheduled_time"`  // NULL for immediate calls
	InitiatedBy   string     `json:"initiated_by"`    // User or System
	CreatedAt     time.Time  `json:"created_at"`
}

// SchedulePhysioCall schedules a new physio call
func SchedulePhysioCall(assessmentID, callType, initiatedBy string, scheduledTime *time.Time) (*PhysioCall, error) {
	// Validate input
	if callType != "immediate" && callType != "scheduled" {
		return nil, errors.New("invalid call type")
	}
	if initiatedBy != "user" && initiatedBy != "system" {
		return nil, errors.New("invalid initiator")
	}

	query := `
		INSERT INTO physio_calls (assessment_id, call_type, call_status, scheduled_time, initiated_by)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING call_id, created_at
	`

	var callID string
	var createdAt time.Time
	err := db.DB.QueryRow(context.Background(), query, assessmentID, callType, "scheduled", scheduledTime, initiatedBy).Scan(&callID, &createdAt)
	if err != nil {
		return nil, err
	}

	return &PhysioCall{
		CallID:        callID,
		AssessmentID:  assessmentID,
		CallType:      callType,
		CallStatus:    "scheduled",
		ScheduledTime: scheduledTime,
		InitiatedBy:   initiatedBy,
		CreatedAt:     createdAt,
	}, nil
}

// GetPhysioCalls retrieves all physio calls for a given assessment
func GetPhysioCalls(assessmentID string) ([]PhysioCall, error) {
	query := `
		SELECT call_id, assessment_id, call_type, call_status, scheduled_time, initiated_by, created_at
		FROM physio_calls
		WHERE assessment_id = $1
		ORDER BY created_at DESC
	`

	rows, err := db.DB.Query(context.Background(), query, assessmentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var calls []PhysioCall
	for rows.Next() {
		var call PhysioCall
		var scheduledTime *time.Time
		if err := rows.Scan(&call.CallID, &call.AssessmentID, &call.CallType, &call.CallStatus, &scheduledTime, &call.InitiatedBy, &call.CreatedAt); err != nil {
			return nil, err
		}
		call.ScheduledTime = scheduledTime
		calls = append(calls, call)
	}

	if len(calls) == 0 {
		return nil, errors.New("no physio calls found for the given assessment ID")
	}

	return calls, nil
}
