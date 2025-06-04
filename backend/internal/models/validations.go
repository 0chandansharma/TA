package models

import "fmt"

// IsValid checks if the assessment status is valid
func (s AssessmentStatus) IsValid() bool {
    switch s {
    case StatusStarted, StatusInProgress, StatusCompleted, StatusAbandoned:
        return true
    }
    return false
}

// String converts the enum to its string representation
func (s AssessmentStatus) String() string {
	if !s.IsValid() {
		return fmt.Sprintf("InvalidAssessmentStatus(%s)", string(s))
	}
	return string(s)
}