package services

import (
	"ai-bot-deecogs/internal/db"
	"context"
	"encoding/json"
	"log"
	"time"
)

type AIAnalysis struct {
	AnalysisID     uint32      `json:"analysisId"`
	AssessmentID   uint32      `json:"assessmentId"`
	AssessmentData json.RawMessage `json:"assessmentData"` // JSONB type
	AnalysedResults json.RawMessage `json:"analysedResults"` // JSONB type
	CreatedAt      *time.Time      `json:"created_at"`
}

//FetchAnalysisDataByAssessmentId retrieves the AI analysis data for a given assessment
func FetchAnalysisDataByAssessmentId(assessmentID uint32) (*AIAnalysis, error) {
	var analysedResults AIAnalysis
	query := `SELECT analysis_id, assessment_id, assessment_data, analysed_results, created_at FROM ai_analysis WHERE assessment_id = $1 order by created_at desc limit 1`
	err := db.DB.QueryRow(context.Background(), query, assessmentID).Scan(
		&analysedResults.AnalysisID,
		&analysedResults.AssessmentID,
		&analysedResults.AssessmentData,
		&analysedResults.AnalysedResults,
		&analysedResults.CreatedAt,
	)
	if err != nil {
		log.Println("Error fetching AI analysis data:", err)
		return nil, err
	}
	return &analysedResults, nil
}