package handlers

import (
	"ai-bot-deecogs/internal/services"
	"net/http"

	"github.com/gin-gonic/gin"
)

// GetSelfCarePlans handles GET /assessments/:id/self-care-plans
// @Summary Get self-care plans
// @Description Retrieves personalized self-care plans for an assessment
// @Tags Self-Care Plans
// @Produce json
// @Param id path string true "Assessment ID"
// @Success 200 {object} services.SelfCarePlan
// @Failure 404 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /assessments/{id}/self-care-plans [get]
func GetSelfCarePlans(c *gin.Context) {
	assessmentID := c.Param("id")

	plan, err := services.GetSelfCarePlans(assessmentID)
	if err != nil {
		if err.Error() == "no self-care plan found for the given assessment ID" {
			c.JSON(http.StatusNotFound, gin.H{"error": "No self-care plan found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}

	c.JSON(http.StatusOK, plan)
}
