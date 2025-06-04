package services

import (
	"ai-bot-deecogs/internal/db"
	"context"
	"errors"
)

type User struct {
	UserID   string
	Name     string
	Email    string
	Password string
}

// GetUserByEmail retrieves a user by email
func GetUserByEmail(email string) (*User, error) {
	var user User

	query := `
		SELECT user_id, name, email, password
		FROM users
		WHERE email = $1
	`
	err := db.DB.QueryRow(context.Background(), query, email).Scan(&user.UserID, &user.Name, &user.Email, &user.Password)
	if err != nil {
		return nil, errors.New("user not found")
	}

	return &user, nil
}
