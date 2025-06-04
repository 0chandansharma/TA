package helpers

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
)

// APIResponse struct for standardized JSON responses
type APIResponse struct {
	Success    bool        `json:"success"`
	StatusCode int         `json:"statusCode"`
	Data       interface{} `json:"data"`
	Error 	   *string      `json:"error,omitempty"`
}

// SendResponse is a utility function to send formatted JSON responses
func SendResponse(w http.ResponseWriter, success bool, statusCode int, data interface{}, err error) {
	response := APIResponse{
		Success:    success,
		StatusCode: statusCode,
		Data:       data,
	}
	// If an error is provided, log it and include it in the response
	if err != nil {
		errorMessage := err.Error()
		log.Printf("Error: %s\n", errorMessage)
		response.Error = &errorMessage
	}

	// Set headers and write response
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(response)
}


func StringToUInt32(str string) (uint32, error) {
	num, err := strconv.ParseUint(str, 10, 32)
	if err != nil {
		return 0, err
	}
	return uint32(num), nil
}