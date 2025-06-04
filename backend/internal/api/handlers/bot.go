package handlers

import (
	"github.com/gin-gonic/gin"
)

// BotHandlerResponse represents a dummy API response
type BotHandlerResponse struct {
	Message string `json:"message"`
}

// @Summary      bothandler API
// @Description  This is a bothandler API for demonstration purposes
// @Tags         demo
// @Produce      json
// @Success      200  {object}  BotHandlerResponse
// @Router       /bothandler [get]
// BotHandler handles user login
func BotHandler(c *gin.Context) {
    c.JSON(200, gin.H{
        "message": "BotHandler successful",
    })
}
