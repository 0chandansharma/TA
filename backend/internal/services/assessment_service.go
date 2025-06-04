package services

import (
	"ai-bot-deecogs/internal/db"
	"ai-bot-deecogs/internal/models"
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"time"
)

type Assessment struct {
	AssessmentID         uint32        `json:"assessmentId"`
	UserID               uint32        `json:"userId"`
	AnatomyID            uint32        `json:"anatomyId"`
	AssessmentType       string        `json:"assessmentType"`
	StartTime            time.Time     `json:"startTime"`
	EndTime              *time.Time    `json:"endTime,omitempty"`
	Status               string        `json:"status"`
	CompletionPercentage float64       `json:"completionPercentage"`
	ChatHistory          []ChatMessage `json:"chatHistory,omitempty"`
}

// Response format
type APIResponse struct {
	Success    bool        `json:"success"`
	StatusCode int         `json:"statusCode"`
	Data       interface{} `json:"data"`
}

type ChatMessage struct {
	User     string `json:"user"`
	Response string `json:"response,omitempty"` // AI response (optional)
}

type ChatRequest struct {
	ChatHistory []ChatMessage `json:"chat_history"`
}

// NEW: Video request structure for body part identification
type VideoRequest struct {
	ChatHistory []ChatMessage `json:"chat_history"`
	Video       string        `json:"video"` // Base64 encoded video
}

type ChatResponse struct {
	Response string `json:"response"`
}

// GetAssessmentByID retrieves an assessment by ID (stub implementation)
func GetAssessmentByID(assessmentID uint32) (*Assessment, error) {
	// For now, return a mock assessment
	// In production, this would query the database
	assessment := &Assessment{
		AssessmentID:         assessmentID,
		UserID:               1,
		AnatomyID:            3,
		AssessmentType:       "PAIN",
		StartTime:            time.Now().Add(-10 * time.Minute),
		Status:               "in_progress",
		CompletionPercentage: 50,
		ChatHistory:          []ChatMessage{},
	}

	return assessment, nil
}

type QuestionRequest struct {
	QuestionHistory []QuestionMessage `json:"chat_history"`
	Video           string            `json:"video,omitempty"` // Add video field for body part identification
}

type QuestionMessage struct {
	User      string `json:"user"`
	Assistant string `json:"assistant"`
}

// Struct with dynamic fields
type CustomResponse struct {
	Success    bool                   `json:"success"`
	StatusCode int                    `json:"statusCode"`
	Data       map[string]interface{} `json:"data"`
}

// DashboardData represents the data sent to the AI API
type DashboardDataAIRequest struct {
	ChatHistory   []QuestionMessage `json:"chat_history"` //QnA chat_history will be used here
	RangeOfMotion RangeOfMotion     `json:"rangeOfMotion"`
}

// AIRequest represents the final request payload for the AI API
type AIRequest struct {
	Content DashboardDataAIRequest `json:"content"`
}

// AIResponse represents the response from the AI server
type AIResponse struct {
	Success    bool     `json:"success"`
	StatusCode int      `json:"statusCode"`
	Data       AIResult `json:"data"`
}

// StoreAIAnalysis represents the structure for saving AI analysis in DB
type StoreAIAnalysis struct {
	AssessmentID      string          `json:"assessmentId"`
	Symptoms          json.RawMessage `json:"symptoms"`
	PossibleDiagnosis json.RawMessage `json:"possible_diagnosis"`
	NextSteps         string          `json:"next_steps"`
	Action            string          `json:"action"`
	CreatedAt         time.Time       `json:"createdAt"`
}

// AIAnalysis stores symptoms, diagnosis, and next steps
type AIAnalysisResult struct {
	Symptoms          []string `json:"symptoms"`
	PossibleDiagnosis []string `json:"possible_diagnosis"`
	NextSteps         string   `json:"next_steps"`
}

type AIResult struct {
	Response AIAnalysisResult `json:"response"`
	Action   string           `json:"action"`
}

// CreateAssessment creates a new assessment
func CreateAssessment(userID uint32, anatomyID uint32, assessmentType string) (*Assessment, error) {
	var exists bool
	err := db.DB.QueryRow(context.Background(), "SELECT EXISTS (SELECT 1 FROM users WHERE user_id = $1)", userID).Scan(&exists)
	if err != nil {
		return nil, errors.New("database query error")
	}

	if !exists {
		return nil, errors.New("User not found")
	}

	query := `
		INSERT INTO assessments ( user_id, anatomy_id, assessment_type, start_time, status, completion_percentage)
		VALUES ($1, $2, $3, NOW(), $4, $5) RETURNING assessment_id, start_time
	`

	var assessmentID uint32
	var start_time time.Time

	inserterr := db.DB.QueryRow(context.Background(), query, userID, anatomyID, assessmentType, models.StatusStarted.String(), 0).Scan(&assessmentID, &start_time)
	if inserterr != nil {
		log.Println("Error inserting and fetching assessment:", inserterr)
		return nil, inserterr
	}
	return &Assessment{
		AssessmentID:         assessmentID,
		UserID:               userID,
		AnatomyID:            anatomyID,
		AssessmentType:       assessmentType,
		StartTime:            start_time,
		Status:               models.StatusStarted.String(),
		CompletionPercentage: 0,
	}, nil
}

// GetAssessment retrieves an assessment by its ID
func GetAssessment(assessmentID uint32) (*Assessment, error) {
	query := `
		SELECT assessment_id, user_id, anatomy_id, assessment_type, start_time, end_time, status, completion_percentage, chat_history
		FROM assessments
		WHERE assessment_id = $1
	`

	var AssessmentID uint32
	var UserID uint32
	var AnatomyID uint32
	var AssessmentType string
	var StartTime time.Time
	var EndTime sql.NullTime
	var Status string
	var CompletionPercentage float64
	var ChatHistory json.RawMessage

	err := db.DB.QueryRow(context.Background(), query, assessmentID).Scan(
		&AssessmentID,
		&UserID,
		&AnatomyID,
		&AssessmentType,
		&StartTime,
		&EndTime,
		&Status,
		&CompletionPercentage,
		&ChatHistory,
	)
	if err != nil {
		return nil, err
	}

	var endTimeValue *time.Time
	if EndTime.Valid {
		endTimeValue = &EndTime.Time
	} else {
		endTimeValue = nil
	}

	var chatHistory []ChatMessage
	if ChatHistory == nil {
		log.Println("No chat history found for this assessment")
		chatHistory = []ChatMessage{} // Initialize empty array
	} else {
		// Try to unmarshal directly first (new format)
		if err := json.Unmarshal(ChatHistory, &chatHistory); err != nil {
			log.Println("Direct unmarshal failed, trying nested format...")
			// If that fails, try the nested approach (legacy format)
			var outerChatHistory map[string]json.RawMessage
			if err := json.Unmarshal(ChatHistory, &outerChatHistory); err != nil {
				log.Println("Failed to parse outer chat history JSON:", err)
				return nil, err
			}

			// Step 2: Extract Inner `chat_history` JSON
			if rawInner, exists := outerChatHistory["chat_history"]; exists {
				if err := json.Unmarshal(rawInner, &chatHistory); err != nil {
					log.Println("Failed to parse inner chat history JSON:", err)
					return nil, err
				}
			} else {
				log.Println("Could not parse chat_history in any known format, using empty array")
				chatHistory = []ChatMessage{} // Initialize empty array instead of error
			}
		}
	}

	return &Assessment{
		AssessmentID:         AssessmentID,
		UserID:               UserID,
		AnatomyID:            AnatomyID,
		AssessmentType:       AssessmentType,
		StartTime:            StartTime,
		EndTime:              endTimeValue,
		Status:               Status,
		CompletionPercentage: CompletionPercentage,
		ChatHistory:          chatHistory,
	}, nil
}

// SendChatToAI sends chat history to the AI model and retrieves a response
func SendChatToAI(assessmentIDUint uint32, chatMessage []ChatMessage) (APIResponse, error) {
	var aiResponse APIResponse

	url := "https://deecogs-bpi-bot-844145949029.europe-west1.run.app/chat"

	// Prepare the request payload
	payload := ChatRequest{ChatHistory: chatMessage}
	jsonData, err := json.Marshal(payload)
	if err != nil {
		return aiResponse, err
	}

	// Send the request to the AI model
	resp, err := http.Post(url, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return aiResponse, err
	}
	defer resp.Body.Close()

	log.Printf("Response Status: %v\n", resp.StatusCode)

	if resp.StatusCode != http.StatusOK {
		return aiResponse, errors.New("failed to get a response from AI model")
	}

	if err := json.NewDecoder(resp.Body).Decode(&aiResponse); err != nil {
		return aiResponse, err
	}

	if aiResponse.Data != nil {
		action := aiResponse.Data.(map[string]interface{})["action"]
		log.Printf("Action: %v\n", action)
		if action == "next_api" {
			log.Println("Next API call")
			//stringify the ChatRequest and save it in the database
			query := `UPDATE assessments SET chat_history = $1 WHERE assessment_id = $2 RETURNING assessment_id`
			var assessmentID string

			err = db.DB.QueryRow(context.Background(), query, jsonData, assessmentIDUint).Scan(&assessmentID)
			if err != nil {
				return aiResponse, err
			}
		}
	}

	return aiResponse, nil
}

// NEW: SendVideoToAI sends video with chat history to AI for body part identification
func SendVideoToAI(assessmentIDUint uint32, videoRequest VideoRequest) (APIResponse, error) {
	var aiResponse APIResponse

	url := "https://deecogs-bpi-bot-844145949029.europe-west1.run.app/chat"

	// Prepare the request payload with video
	payload := struct {
		ChatHistory []ChatMessage `json:"chat_history"`
		Video       string        `json:"video"`
	}{
		ChatHistory: videoRequest.ChatHistory,
		Video:       videoRequest.Video,
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return aiResponse, err
	}

	log.Printf("Sending video for body part identification, payload size: %d bytes", len(jsonData))

	// Send the request to the AI model
	resp, err := http.Post(url, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return aiResponse, err
	}
	defer resp.Body.Close()

	log.Printf("Video Response Status: %v\n", resp.StatusCode)

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		log.Printf("Error response body: %s", string(bodyBytes))
		return aiResponse, errors.New("failed to get a response from AI model for video")
	}

	if err := json.NewDecoder(resp.Body).Decode(&aiResponse); err != nil {
		return aiResponse, err
	}

	// Don't save video to chat history, just process the response
	log.Println("Video processed successfully for body part identification")

	return aiResponse, nil
}

// SendQuestionsToAI sends chat history to the AI model and retrieves a response
func SendQuestionsToAI(assessmentIDUint uint32, questionRequest QuestionRequest) (APIResponse, error) {
	var aiResponse APIResponse

	url := "https://deecogs-xai-bot-844145949029.europe-west1.run.app/chat"

	// Prepare the request payload (now includes video if present)
	payload := questionRequest
	jsonData, err := json.Marshal(payload)
	if err != nil {
		return aiResponse, err
	}

	// Send the request to the AI model
	resp, err := http.Post(url, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return aiResponse, err
	}
	defer resp.Body.Close()

	log.Printf("Response: %v\n", resp)

	if resp.StatusCode != http.StatusOK {
		return aiResponse, errors.New("failed to get a response from AI model")
	}

	if err := json.NewDecoder(resp.Body).Decode(&aiResponse); err != nil {
		return aiResponse, err
	}

	if aiResponse.Data != nil {
		action := aiResponse.Data.(map[string]interface{})["action"]
		if action == "next_api" || action == "rom_api" {
			log.Println("Next API call")
			//stringify the ChatRequest and save it in the database
			query := `INSERT INTO questionnaires (assessment_id, chat_history) VALUES ($1, $2) RETURNING question_id`
			var questionID string

			err = db.DB.QueryRow(context.Background(), query, assessmentIDUint, jsonData).Scan(&questionID)
			if err != nil {
				return aiResponse, err
			}
		}
	}

	return aiResponse, nil
}

// UpdateAssessmentStatus updates the status of an assessment
func UpdateAssessmentStatus(assessmentID string, status models.AssessmentStatus) error {
	// Validate the status
	if !status.IsValid() {
		return errors.New("invalid assessment status")
	}

	query := `
		UPDATE assessments
		SET status = $1
		WHERE assessment_id = $2
	`
	result, err := db.DB.Exec(context.Background(), query, status.String(), assessmentID)
	if err != nil {
		return err
	}

	rowsAffected := result.RowsAffected()
	if rowsAffected == 0 {
		return errors.New("assessment not found")
	}

	return nil
}

type StartSessionRequest struct {
	UserID string `json:"userId"`
}

// Response structure
type StartSessionResponse struct {
	AssessmentID string `json:"assessmentId"`
	Message      string `json:"message"`
}

// FetchAssessmentData retrieves chat history & ROM data for assessment
func FetchAssessmentData(assessmentID uint32) (*DashboardDataAIRequest, error) {
	var chatHistoryRaw json.RawMessage
	var poseModelDataRaw json.RawMessage
	var response *DashboardDataAIRequest

	// Fetch chat history from `questionnaires`
	queryChat := `SELECT chat_history FROM questionnaires WHERE assessment_id = $1 order by created_at desc limit 1`
	err := db.DB.QueryRow(context.Background(), queryChat, assessmentID).Scan(&chatHistoryRaw)
	if err != nil {
		if err == sql.ErrNoRows {
			log.Println("Chat history not found for assessment:", assessmentID)
			return nil, errors.New("chat history not found")
		}
		log.Println("Failed to fetch chat history:", err)
		return nil, err
	}

	// Fetch pose model data from `rom_analysis`
	queryROM := `SELECT pose_model_data FROM rom_analysis WHERE assessment_id = $1 order by created_at desc limit 1`
	err = db.DB.QueryRow(context.Background(), queryROM, assessmentID).Scan(&poseModelDataRaw)
	if err != nil {
		if err == sql.ErrNoRows {
			log.Println("Pose model data not found for assessment:", assessmentID)
			return nil, errors.New("pose model data not found")
		}
		log.Println("Failed to fetch pose model data:", err)
		return nil, err
	}

	// Try to unmarshal chat history directly first
	var chatHistory []QuestionMessage
	if err := json.Unmarshal(chatHistoryRaw, &chatHistory); err != nil {
		log.Println("Direct unmarshal failed, trying nested format...")
		// If that fails, try the nested approach (legacy format)
		var outerChatHistory map[string]json.RawMessage
		if err := json.Unmarshal(chatHistoryRaw, &outerChatHistory); err != nil {
			log.Println("Failed to parse outer chat history JSON:", err)
			return nil, err
		}

		// Step 2: Extract Inner `chat_history` JSON
		if rawInner, exists := outerChatHistory["chat_history"]; exists {
			if err := json.Unmarshal(rawInner, &chatHistory); err != nil {
				log.Println("Failed to parse inner chat history JSON:", err)
				return nil, err
			}
		} else {
			log.Println("Could not parse chat_history in any known format, using empty array")
			chatHistory = []QuestionMessage{} // Initialize empty array instead of error
		}
	}

	// Step 1: Convert Raw JSON to Map
	var poseModelData map[string]json.RawMessage
	if err := json.Unmarshal(poseModelDataRaw, &poseModelData); err != nil {
		log.Println("Failed to parse outer poseModelData JSON:", err)
		return nil, err
	}
	// Step 2: Extract Inner `rangeOfMotion` JSON
	var rangeOfMotion RangeOfMotion
	if rawInner, exists := poseModelData["rangeOfMotion"]; exists {
		if err := json.Unmarshal(rawInner, &rangeOfMotion); err != nil {
			log.Println("Failed to parse inner rangeOfMotion JSON:", err)
			return nil, err
		}
	} else {
		log.Println("Inner rangeOfMotion key missing")
		return nil, errors.New("rangeOfMotion format incorrect")
	}

	// Prepare Dashboard Data
	response = &DashboardDataAIRequest{
		ChatHistory:   chatHistory,
		RangeOfMotion: rangeOfMotion,
	}

	return response, nil
}

// RequestAIAnalysisFromAI sends the dashboard data to the AI model and retrieves a response
func RequestAIAnalysisFromAI(assessmentID uint32, dashboardData *DashboardDataAIRequest) (*AIResult, error) {
	aiRequest := AIRequest{Content: *dashboardData}

	// Convert to JSON
	requestBody, err := json.Marshal(aiRequest)
	if err != nil {
		log.Println("Error marshalling AI request:", err)
		return nil, err
	}

	url := "https://europe-west2-dochq-staging.cloudfunctions.net/deecogs-dashboard"

	// Send the request to the AI model
	resp, err := http.Post(url, "application/json", bytes.NewBuffer(requestBody))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, errors.New("failed to get a response from AI model")
	}
	//Read raw response body before decoding
	rawResponse, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Println("Error reading raw response:", err)
		return nil, err
	}
	//Log raw response
	log.Printf("Raw AI API Response: %s\n", string(rawResponse))

	var aiResponse AIResponse
	if err := json.Unmarshal(rawResponse, &aiResponse); err != nil {
		log.Println("Error decoding AI API dashboard response:", err)
		return nil, err
	}

	return &aiResponse.Data, nil
}

// SaveAIAnalysis saves the AI analysis results in the database
func SaveAIAnalysis(assessmentID uint32, dashboardData *DashboardDataAIRequest, aiResult *AIResult) error {
	// Convert AI Analysis to JSON
	response, err := json.Marshal(aiResult.Response)
	if err != nil {
		log.Println("Error marshalling symptoms:", err)
		return err
	}

	query := `
		INSERT INTO ai_analysis (assessment_id, assessment_data, analysed_results, created_at)
		VALUES ($1, $2, $3, NOW())
	`
	_, err = db.DB.Exec(context.Background(), query, assessmentID, dashboardData, response)
	if err != nil {
		log.Println("Error saving AI analysis:", err)
		return err
	}

	return nil
}

// MarkAssessmentComplete marks the assessment as complete
func MarkAssessmentComplete(assessmentID uint32) error {
	query := `
		UPDATE assessments
		SET status = $1, completion_percentage = $2, end_time = NOW()
		WHERE assessment_id = $3
	`
	_, err := db.DB.Exec(context.Background(), query, models.StatusCompleted.String(), 100, assessmentID)
	if err != nil {
		log.Println("Error marking assessment as complete:", err)
		return err
	}

	return nil
}
