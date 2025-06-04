package services

import (
	"ai-bot-deecogs/internal/db"
	"context"
	"errors"
)

type SelfCarePlan struct {
	AssessmentID       string      `json:"assessment_id"`
	PlanName           string      `json:"plan_name"`
	SuggestedExercises interface{} `json:"suggested_exercises"` // JSONB for exercises
	CriticalFlag       bool        `json:"critical_flag"`
	CreatedAt          string      `json:"created_at"`
}

// GetSelfCarePlans retrieves self-care plans for a specific assessment
func GetSelfCarePlans(assessmentID string) (*SelfCarePlan, error) {
	query := `
		SELECT assessment_id, plan_name, suggested_exercises, critical_flag, created_at
		FROM self_care_plans
		WHERE assessment_id = $1
	`

	var plan SelfCarePlan
	err := db.DB.QueryRow(context.Background(), query, assessmentID).Scan(
		&plan.AssessmentID,
		&plan.PlanName,
		&plan.SuggestedExercises,
		&plan.CriticalFlag,
		&plan.CreatedAt,
	)
	if err != nil {
		if err.Error() == "no rows in result set" {
			return nil, errors.New("no self-care plan found for the given assessment ID")
		}
		return nil, err
	}

	return &plan, nil
}
