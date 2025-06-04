package handlers

// SubmitROMAnalysis handles POST /assessments/:id/rom
// @Summary Submit ROM analysis data
// @Description Submits pose model data and analysis results for an assessment
// @Tags ROM
// @Accept json
// @Produce json
// @Param id path string true "Assessment ID"
// @Param rom_data body services.ROMAnalysis true "ROM Data"
// @Success 201 {object} map[string]string
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /assessments/{id}/rom [post]
// func SubmitROMAnalysis(c *gin.Context) {
// 	assessmentID := c.Param("id")

// 	var request services.ROMAnalysis
// 	if err := c.ShouldBindJSON(&request); err != nil {
// 		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
// 		return
// 	}

// 	request.AssessmentID = assessmentID
// 	if err := services.SubmitROMAnalysis(request); err != nil {
// 		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to submit ROM analysis"})
// 		return
// 	}

// 	c.JSON(http.StatusCreated, gin.H{"message": "ROM analysis submitted successfully"})
// }

// GetROMAnalysis handles GET /assessments/:id/rom
// @Summary Get ROM analysis data
// @Description Retrieves pose model data and analysis results for an assessment
// @Tags ROM
// @Produce json
// @Param id path string true "Assessment ID"
// @Success 200 {array} services.ROMAnalysis
// @Failure 404 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /assessments/{id}/rom [get]
// func GetROMAnalysis(c *gin.Context) {
// 	assessmentID := c.Param("id")

// 	data, err := services.GetROMAnalysis(assessmentID)
// 	if err != nil {
// 		if err.Error() == "no ROM analysis found for the given assessment ID" {
// 			c.JSON(http.StatusNotFound, gin.H{"error": "No ROM analysis found"})
// 		} else {
// 			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
// 		}
// 		return
// 	}

// 	c.JSON(http.StatusOK, data)
// }