package models

// AssessmentStatus represents the status of an assessment
type AssessmentStatus string

const (
	StatusStarted AssessmentStatus = "started"
    StatusInProgress AssessmentStatus = "in_progress"
    StatusCompleted  AssessmentStatus = "completed"
    StatusAbandoned  AssessmentStatus = "abandoned"
)

