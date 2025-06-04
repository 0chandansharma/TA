package handlers

// CorrectAnswerRequest represents the request body for updating the correct answer
type CorrectAnswerRequest struct {
	CorrectAnswer string `json:"correct_answer" binding:"required"`
}

