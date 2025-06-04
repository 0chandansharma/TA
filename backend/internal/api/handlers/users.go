package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// CreateUser handles POST /users
// @Summary Create a new user
// @Description Creates a new user with the provided details
// @Tags Users
// @Accept json
// @Produce json
// @Param user body map[string]interface{} true "User Data"
// @Success 201 {object} map[string]string
// @Failure 400 {object} map[string]string
// @Router /users [post]
func CreateUser(c *gin.Context) {
	var user map[string]interface{}
	if err := c.ShouldBindJSON(&user); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user data"})
		return
	}
	// Logic to create user (e.g., insert into database)
	c.JSON(http.StatusCreated, gin.H{"message": "User created successfully!", "user": user})
}

// GetUser handles GET /users/:id
// @Summary Get user details
// @Description Retrieves details of a user by ID
// @Tags Users
// @Produce json
// @Param id path string true "User ID"
// @Success 200 {object} map[string]interface{}
// @Failure 404 {object} map[string]string
// @Router /users/{id} [get]
func GetUser(c *gin.Context) {
	userID := c.Param("id")
	// Logic to fetch user details (e.g., query from database)
	c.JSON(http.StatusOK, gin.H{
		"user_id": userID,
		"name":    "John Doe",
		"email":   "john.doe@example.com",
	})
}
