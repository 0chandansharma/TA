package handlers

import (
	"ai-bot-deecogs/internal/services"
	"net/http"

	"github.com/gin-gonic/gin"
)

// LoginUser handles POST /auth/loginuser
// @Summary Login user
// @Description Authenticates a user with email and password
// @Tags Auth
// @Accept json
// @Produce json
// @Param credentials body map[string]string true "User Credentials"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Router /auth/loginuser [post]
func LoginUser(c *gin.Context) {
	// Parse the login credentials
	var credentials struct {
		Email    string `json:"email" binding:"required,email"`
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&credentials); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Fetch the user from the service layer
	user, err := services.GetUserByEmail(credentials.Email)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}

	// Validate the password (in a real-world app, use hashed passwords)
	if credentials.Password != user.Password {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}

	// Return user details (excluding password)
	c.JSON(http.StatusOK, gin.H{
		"user_id": user.UserID,
		"name":    user.Name,
		"email":   user.Email,
	})
}
