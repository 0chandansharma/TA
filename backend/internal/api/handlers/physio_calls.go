package handlers

import (
	"ai-bot-deecogs/internal/services"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// PhysioCallRequest represents the request body for scheduling a physio call
type PhysioCallRequest struct {
	CallType      string `json:"call_type" binding:"required"` // Immediate or Scheduled
	ScheduledTime string `json:"scheduled_time,omitempty"`    // Optional for immediate calls
	InitiatedBy   string `json:"initiated_by" binding:"required"`
}

// SchedulePhysioCall handles POST /assessments/:id/physio-calls
// @Summary Schedule a physio call
// @Description Schedules a physio call (immediate or scheduled) for a specific assessment
// @Tags Physio Calls
// @Accept json
// @Produce json
// @Param id path string true "Assessment ID"
// @Param call_data body PhysioCallRequest true "Call Details"
// @Success 201 {object} services.PhysioCall
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /assessments/{id}/physio-calls [post]
func SchedulePhysioCall(c *gin.Context) {
	assessmentID := c.Param("id")

	var request PhysioCallRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var scheduledTime *time.Time
	if request.ScheduledTime != "" {
		parsedTime, err := time.Parse(time.RFC3339, request.ScheduledTime)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid scheduled time format"})
			return
		}
		scheduledTime = &parsedTime
	}

	call, err := services.SchedulePhysioCall(assessmentID, request.CallType, request.InitiatedBy, scheduledTime)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, call)
}

// GetPhysioCalls handles GET /assessments/:id/physio-calls
// @Summary Get physio calls
// @Description Retrieves all physio calls for a specific assessment
// @Tags Physio Calls
// @Produce json
// @Param id path string true "Assessment ID"
// @Success 200 {array} services.PhysioCall
// @Failure 404 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /assessments/:id/physio-calls [get]
func GetPhysioCalls(c *gin.Context) {
	assessmentID := c.Param("id")

	calls, err := services.GetPhysioCalls(assessmentID)
	if err != nil {
		if err.Error() == "no physio calls found for the given assessment ID" {
			c.JSON(http.StatusNotFound, gin.H{"error": "No physio calls found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}

	c.JSON(http.StatusOK, calls)
}