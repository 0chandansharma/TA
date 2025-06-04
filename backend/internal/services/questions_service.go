package services

import (
	"ai-bot-deecogs/internal/db"
	"context"
	"encoding/json"
	"errors"
	"time"
)

type Question struct {
	QuestionID    string      `json:"questionId"`
	AssessmentID  string      `json:"assessmentId"`
	ChatHistory	  json.RawMessage `json:"chatHistory,omitempty"`
	CreatedAt     time.Time `json:"startTime"`
}


func GetQuestionByAssessmentID(assessmentID uint32) (*Question, error) {
	query := `
		SELECT question_id, assessment_id, chat_history, created_at
		FROM questionnaires
		WHERE assessment_id = $1
		order by created_at desc limit 1
	`

	var question Question
	// var chatHistory json.RawMessage
	err := db.DB.QueryRow(context.Background(), query, assessmentID).Scan(
		&question.QuestionID,
		&question.AssessmentID,
		&question.ChatHistory,
		&question.CreatedAt,
	)
	if err != nil {
		if err.Error() == "no rows in result set" {
			return nil, errors.New("question not found")
		}
		return nil, err
	}

	question.ChatHistory = json.RawMessage(question.ChatHistory)

	return &question, nil
}
