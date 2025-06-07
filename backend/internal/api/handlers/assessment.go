package handlers

import (
	"ai-bot-deecogs/internal/helpers"
	"ai-bot-deecogs/internal/models"
	"ai-bot-deecogs/internal/services"
	"bytes"
	"fmt"
	"io"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

// CreateAssessment handles POST /assessments
// @Summary Start a new assessment
// @Description Creates a new assessment for the user
// @Tags Assessments
// @Accept json
// @Produce json
// @Param assessment body map[string]string true "Assessment Data"
// @Success 201 {object} services.Assessment
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /assessments [post]
func CreateAssessment(c *gin.Context) {
	var request struct {
		UserID         uint32 `json:"userId" binding:"required"`
		AnatomyID      uint32 `json:"anatomyId" binding:"required"`
		AssessmentType string `json:"assessmentType" binding:"required"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	assessment, err := services.CreateAssessment(request.UserID, request.AnatomyID, request.AssessmentType)
	if err != nil {
		log.Println("Error creating assessment:")
		helpers.SendResponse(c.Writer, false, http.StatusInternalServerError, "", err)
		return
	}

	helpers.SendResponse(c.Writer, true, http.StatusCreated, assessment, nil)
}

// SendChatToAIHandler handles POST /assessments/:assessmentId/chat
// @Summary Send chat history for AI response
// @Description Sends chat history to an AI model for physiotherapy assessment
// @Tags Assessments
// @Accept json
// @Produce json
// @Param id path string true "Assessment ID"
// @Param chat_body body services.ChatRequest true "Chat History"
// @Success 200 {object} services.ChatResponse
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /assessments/{assessmentId}/chat [post]
func SendChatToAIHandler(c *gin.Context) {
	assessmentID := c.Param("assessmentId")

	// Create a flexible request structure that can handle both chat_history and video
	var chatRequest struct {
		ChatHistory []services.ChatMessage `json:"chat_history"`
		Video       string                 `json:"video,omitempty"` // Optional video field
	}

	if err := c.ShouldBindJSON(&chatRequest); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
		return
	}

	log.Printf("Chat Request: %+v\n", chatRequest)
	log.Printf("Assessment ID: %s\n", assessmentID)

	// Check if this is a video request
	if chatRequest.Video != "" {
		log.Println("Received video for body part identification")
		// Handle video differently - don't add to chat history
		// Create a special request for video processing
		videoRequest := services.VideoRequest{
			ChatHistory: chatRequest.ChatHistory,
			Video:       chatRequest.Video,
		}

		assessmentIDUint, unitErr := helpers.StringToUInt32(assessmentID)
		if unitErr != nil {
			log.Println(`Error converting assessment ID to uint32 `, assessmentID)
			helpers.SendResponse(c.Writer, false, http.StatusInternalServerError, "", unitErr)
			return
		}

		_, err := services.GetAssessment(assessmentIDUint)
		if err != nil {
			log.Println(`Error fetching the assessment `, assessmentID)
			helpers.SendResponse(c.Writer, false, http.StatusInternalServerError, "", err)
			return
		}

		// Call the AI service with video
		aiResponse, err := services.SendVideoToAI(assessmentIDUint, videoRequest)
		if err != nil {
			log.Println(`Error sending video to AI `, assessmentID)
			helpers.SendResponse(c.Writer, false, http.StatusInternalServerError, "", err)
			return
		}

		helpers.SendResponse(c.Writer, true, http.StatusOK, aiResponse.Data, nil)
		return
	}

	// Handle regular chat (text-based)
	assessmentIDUint, unitErr := helpers.StringToUInt32(assessmentID)
	if unitErr != nil {
		log.Println(`Error converting assessment ID to uint32 `, assessmentID)
		helpers.SendResponse(c.Writer, false, http.StatusInternalServerError, "", unitErr)
		return
	}

	_, err := services.GetAssessment(assessmentIDUint)
	if err != nil {
		log.Println(`Error fetching the assessment `, assessmentID)
		helpers.SendResponse(c.Writer, false, http.StatusInternalServerError, "", err)
		return
	}

	// Call the AI service for regular chat
	aiResponse, err := services.SendChatToAI(assessmentIDUint, chatRequest.ChatHistory)
	if err != nil {
		log.Println(`Error sending chat to AI `, assessmentID)
		helpers.SendResponse(c.Writer, false, http.StatusInternalServerError, "", err)
		return
	}

	helpers.SendResponse(c.Writer, true, http.StatusOK, aiResponse.Data, nil)
}

// GetAssessment handles GET /assessments/:assessmentId
// @Summary Get assessment details
// @Description Retrieves the details of a specific assessment
// @Tags Assessments
// @Produce json
// @Param assessmentId path string true "Assessment ID"
// @Success 200 {object} services.Assessment
// @Failure 404 {object} map[string]string
// @Router /assessments/{assessmentId} [get]
func GetAssessment(c *gin.Context) {
	assessmentID := c.Param("assessmentId")

	assessmentIDUint, unitErr := helpers.StringToUInt32(assessmentID)
	if unitErr != nil {
		log.Println(`Error converting assessment ID to uint32 `, assessmentID)
		helpers.SendResponse(c.Writer, false, http.StatusInternalServerError, "", unitErr)
		return
	}

	assessment, err := services.GetAssessment(assessmentIDUint)
	if err != nil {
		helpers.SendResponse(c.Writer, false, http.StatusNotFound, "", err)
		return
	}

	helpers.SendResponse(c.Writer, true, http.StatusOK, assessment, nil)
}

// UpdateAssessmentStatus handles PATCH /assessments/:id/status
// @Summary Update assessment status
// @Description Updates the status of an assessment
// @Tags Assessments
// @Accept json
// @Produce json
// @Param assessmentId path string true "Assessment ID"
// @Param status body map[string]string true "Status Update"
// @Success 200 {object} map[string]string
// @Failure 400 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Router /assessments/{assessmentId}/status [post]
func UpdateAssessmentStatus(c *gin.Context) {
	assessmentID := c.Param("assessmentId")

	var request struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	status := models.AssessmentStatus(request.Status)
	if err := services.UpdateAssessmentStatus(assessmentID, status); err != nil {
		if err.Error() == "assessment not found" {
			c.JSON(http.StatusNotFound, gin.H{"error": "Assessment not found"})
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Assessment status updated successfully"})
}

// SendQuestionsToAIHandler handles POST /assessments/:assessmentId/questionnaires
// @Summary Send questions to AI
// @Description Sends questions to an AI model for assessment
// @Tags Assessments
// @Accept json
// @Produce json
// @Param id path string true "Assessment ID"
// @Param questions body services.QuestionRequest true "Questions"
// @Success 200 {object} services.QuestionResponse
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /assessments/{assessmentId}/questionnaires [post]

// backend/internal/api/handlers/assessment.go
// Fixed SendQuestionsToAIHandler that works with existing code

// Replace the existing SendQuestionsToAIHandler in assessment.go with this version

// SendQuestionsToAIHandler handles POST /assessments/:assessmentId/questionnaires
// @Summary Send questions to AI
// @Description Sends questions to an AI model for assessment
// @Tags Assessments
// @Accept json
// @Produce json
// @Param id path string true "Assessment ID"
// @Param questions body services.QuestionRequest true "Questions"
// @Success 200 {object} services.QuestionResponse
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /assessments/{assessmentId}/questionnaires [post]
func SendQuestionsToAIHandler(c *gin.Context) {
	assessmentID := c.Param("assessmentId")

	// First, try to bind as QuestionRequest
	var questionRequest services.QuestionRequest
	if err := c.ShouldBindJSON(&questionRequest); err != nil {
		// If that fails, try the chat_history format
		c.Request.Body = io.NopCloser(bytes.NewReader([]byte(c.Keys["body_bytes"].([]byte))))

		var chatRequest struct {
			ChatHistory []services.QuestionMessage `json:"chat_history"`
		}

		if err2 := c.ShouldBindJSON(&chatRequest); err2 != nil {
			log.Printf("Error parsing request body: %v", err2)
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
			return
		}

		questionRequest.QuestionHistory = chatRequest.ChatHistory
	}

	// Remove duplicate body part messages
	cleanedHistory := []services.QuestionMessage{}
	lastWasBodyPart := false

	for _, msg := range questionRequest.QuestionHistory {
		isBodyPart := msg.User == "User has shown body part on video"

		// Skip if this is a duplicate body part message
		if isBodyPart && lastWasBodyPart {
			log.Printf("Removing duplicate body part message")
			continue
		}

		cleanedHistory = append(cleanedHistory, msg)
		lastWasBodyPart = isBodyPart
	}

	questionRequest.QuestionHistory = cleanedHistory

	// Convert assessment ID
	assessmentIDUint, err := helpers.StringToUInt32(assessmentID)
	if err != nil {
		log.Printf("Error converting assessment ID: %s", assessmentID)
		helpers.SendResponse(c.Writer, false, http.StatusBadRequest, "", err)
		return
	}

	// Verify assessment exists and is active
	assessment, err := services.GetAssessment(assessmentIDUint)
	if err != nil {
		log.Printf("Assessment not found: %d", assessmentIDUint)
		helpers.SendResponse(c.Writer, false, http.StatusNotFound, "", err)
		return
	}

	// Check if assessment is already completed
	if assessment.Status == "completed" || assessment.Status == "abandoned" {
		log.Printf("Assessment %d is already %s", assessmentIDUint, assessment.Status)
		helpers.SendResponse(c.Writer, false, http.StatusBadRequest,
			fmt.Sprintf("Assessment is already %s", assessment.Status), nil)
		return
	}

	log.Printf("Processing questionnaire for assessment %d with %d messages",
		assessmentIDUint, len(questionRequest.QuestionHistory))

	// Call the AI service
	aiResponse, err := services.SendQuestionsToAI(assessmentIDUint, questionRequest)
	if err != nil {
		log.Printf("Error sending questions to AI: %v", err)

		// Return user-friendly error message
		errorMessage := "Error processing your question. Please try again."
		if err.Error() == "failed to get a response from AI model" {
			errorMessage = "AI service is temporarily unavailable. Please try again in a moment."
		}

		helpers.SendResponse(c.Writer, false, http.StatusInternalServerError, errorMessage, err)
		return
	}

	// Update assessment status if needed
	if aiResponse.Data != nil {
		if dataMap, ok := aiResponse.Data.(map[string]interface{}); ok {
			if action, exists := dataMap["action"]; exists {
				log.Printf("AI action: %v", action)

				// Update status to in_progress if it's still in started state
				if assessment.Status == "started" {
					updateErr := services.UpdateAssessmentStatus(assessmentID, models.StatusInProgress)
					if updateErr != nil {
						log.Printf("Warning: Failed to update assessment status: %v", updateErr)
					}
				}
			}
		}
	}

	helpers.SendResponse(c.Writer, true, http.StatusOK, aiResponse.Data, nil)
}

// Add this middleware to store request body for re-reading
func StoreRequestBody() gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.Body != nil {
			bodyBytes, _ := io.ReadAll(c.Request.Body)
			c.Request.Body = io.NopCloser(bytes.NewReader(bodyBytes))
			c.Set("body_bytes", bodyBytes)
		}
		c.Next()
	}
}

// GetQuestion
// @Summary Get a question by its AssessmentID
// @Description Fetches a question by its AssessmentID
// @Tags Questions
// @Accept json
// @Produce json
// @Param assessmentId path string true "Assessment ID"
// @Success 200 {object} services.Question
// @Failure 404 {object} map[string]string
// @Router /assessments/:assessmentId/questionnaires
func GetQuestionnaires(c *gin.Context) {
	assessmentID := c.Param("assessmentId")

	assessmentIDUint, unitErr := helpers.StringToUInt32(assessmentID)
	if unitErr != nil {
		log.Println(`Error converting assessment ID to uint32 `, assessmentID)
		helpers.SendResponse(c.Writer, false, http.StatusInternalServerError, "", unitErr)
		return
	}

	assessment, err := services.GetQuestionByAssessmentID(assessmentIDUint)
	if err != nil {
		helpers.SendResponse(c.Writer, false, http.StatusNotFound, "", err)
		return
	}

	helpers.SendResponse(c.Writer, true, http.StatusOK, assessment, nil)
}

// SubmitROMAnalysis handles POST /assessments/:assessmentId/romAnalysis
// @Summary Submit ROM analysis data
// @Description Submits pose model data and analysis results for an assessment
// @Tags ROM
// @Accept json
// @Produce json
// @Param assessmentId path string true "Assessment ID"
// @Param romAnalysis body services.ROMAnalysis true "ROM Analysis Data"
// @Success 201 {object} map[string]string
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /assessments/{assessmentId}/romAnalysis [post]
func SubmitROMAnalysis(c *gin.Context) {
	assessmentID := c.Param("assessmentId")

	var request services.ROMRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	assessmentIDUint, unitErr := helpers.StringToUInt32(assessmentID)
	if unitErr != nil {
		log.Println(`Error converting assessment ID to uint32 `, assessmentID)
		helpers.SendResponse(c.Writer, false, http.StatusInternalServerError, "", unitErr)
		return
	}

	//check if assessment exists
	_, assessmentErr := services.GetAssessment(assessmentIDUint)
	if assessmentErr != nil {
		helpers.SendResponse(c.Writer, false, http.StatusNotFound, "", assessmentErr)
		return
	}

	_, err := services.SubmitROMAnalysis(assessmentIDUint, request.RangeOfMotion)
	if err != nil {
		helpers.SendResponse(c.Writer, false, http.StatusInternalServerError, "", err)
		return
	}

	helpers.SendResponse(c.Writer, true, http.StatusCreated, "ROM analysis submitted successfully", nil)
}

// GetROMAnalysisByAssessmentId handles GET /assessments/:assessmentId/romAnalysis
// @Summary Get ROM analysis data
// @Description Retrieves pose model data and analysis results for an assessment
// @Tags ROM
// @Produce json
// @Param assessmentId path string true "Assessment ID"
// @Success 200 {object} services.ROMDataResponse
// @Failure 404 {object} map[string]string
// @Router /assessments/{assessmentId}/romAnalysis [get]
func GetROMAnalysisByAssessmentId(c *gin.Context) {
	assessmentID := c.Param("assessmentId")

	assessmentIDUint, unitErr := helpers.StringToUInt32(assessmentID)
	if unitErr != nil {
		log.Println(`Error converting assessment ID to uint32 `, assessmentID)
		helpers.SendResponse(c.Writer, false, http.StatusInternalServerError, "", unitErr)
		return
	}

	//check if assessment exists
	_, assessmentErr := services.GetAssessment(assessmentIDUint)
	if assessmentErr != nil {
		helpers.SendResponse(c.Writer, false, http.StatusNotFound, "", assessmentErr)
		return
	}

	romData, err := services.GetROMAnalysisByAssessmentId(assessmentIDUint)
	if err != nil {
		helpers.SendResponse(c.Writer, false, http.StatusNotFound, "", err)
		return
	}

	helpers.SendResponse(c.Writer, true, http.StatusOK, romData, nil)
}

// GetDashboardData handles GET /assessments/:assessmentId/dashboard
// @Summary Get dashboard data
// @Description Retrieves dashboard data for an assessment
// @Tags Dashboard
// @Produce json
// @Param assessmentId path string true "Assessment ID"
// @Success 200 {object} services.DashboardData
// @Failure 404 {object} map[string]string
// @Router /assessments/{assessmentId}/dashboard [get]
func GetDashboardData(c *gin.Context) {
	assessmentID := c.Param("assessmentId")

	assessmentIDUint, unitErr := helpers.StringToUInt32(assessmentID)
	if unitErr != nil {
		log.Println(`Error converting assessment ID to uint32 `, assessmentID)
		helpers.SendResponse(c.Writer, false, http.StatusInternalServerError, "", unitErr)
		return
	}

	//check if assessment exists
	_, assessmentErr := services.GetAssessment(assessmentIDUint)
	if assessmentErr != nil {
		helpers.SendResponse(c.Writer, false, http.StatusNotFound, "", assessmentErr)
		return
	}

	dashboardData, err := services.FetchAssessmentData(assessmentIDUint)
	if err != nil {
		helpers.SendResponse(c.Writer, false, http.StatusNotFound, "", err)
		return
	}

	// Send data to AI API
	aiResult, err := services.RequestAIAnalysisFromAI(assessmentIDUint, dashboardData)
	if err != nil {
		helpers.SendResponse(c.Writer, false, 500, "Failed to process AI analysis", err)
		return
	}

	// Save AI analysis in database
	err = services.SaveAIAnalysis(assessmentIDUint, dashboardData, aiResult)
	if err != nil {
		helpers.SendResponse(c.Writer, false, 500, "Failed to save AI analysis", err)
		return
	}

	//mark assessment as completed
	err = services.MarkAssessmentComplete(assessmentIDUint)
	if err != nil {
		helpers.SendResponse(c.Writer, false, 500, "Failed to mark assessment as complete", err)
		return
	}

	helpers.SendResponse(c.Writer, true, http.StatusOK, aiResult, nil)
}

// GetDashboardDataByAssessmentId handles GET /assessments/:assessmentId/dashboardByAssessmentId
// @Summary Get dashboard data
// @Description Retrieves dashboard data for an assessment
// @Tags Dashboard
// @Produce json
// @Param assessmentId path string true "Assessment ID"
// @Success 200 {object} services.DashboardData
// @Failure 404 {object} map[string]string
// @Router /assessments/{assessmentId}/dashboardByAssessmentId [get]
func GetDashboardDataByAssessmentId(c *gin.Context) {
	assessmentID := c.Param("assessmentId")

	assessmentIDUint, unitErr := helpers.StringToUInt32(assessmentID)
	if unitErr != nil {
		log.Println(`Error converting assessment ID to uint32 `, assessmentID)
		helpers.SendResponse(c.Writer, false, http.StatusInternalServerError, "", unitErr)
		return
	}

	//check if assessment exists
	_, assessmentErr := services.GetAssessment(assessmentIDUint)
	if assessmentErr != nil {
		helpers.SendResponse(c.Writer, false, http.StatusNotFound, "", assessmentErr)
		return
	}

	analysisData, err := services.FetchAnalysisDataByAssessmentId(assessmentIDUint)
	if err != nil {
		helpers.SendResponse(c.Writer, false, http.StatusNotFound, "", err)
		return
	}
	helpers.SendResponse(c.Writer, true, http.StatusOK, analysisData, nil)
}
