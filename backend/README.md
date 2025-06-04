# AI Bot Deecogs

A Go-based REST API service for physiotherapy assessments with AI integration.

## Project Structure

# Binaries

/bin/
_.exe
_.out

# Dependencies

/vendor/

# Environment files

.env

## Setup & Running

1. **Database Migration**
   ```bash
   # Create initial migration
   migrate create -ext sql -dir migrations -seq init_schema

   # Run migrations up
   go run cmd/migrate/main.go --direction=up

   # Run migrations down (if needed)
   go run cmd/migrate/main.go --direction=down
   ```

2. **Run Application**
   ```bash
   # Start the server
   go run cmd/app/main.go
   ```

3. **API Documentation**
   ```
   # Access Swagger UI
   http://localhost:8080/swagger/index.html

## Features

- Assessment Management
- AI-powered Chat Interface
- ROM (Range of Motion) Analysis
- Questionnaire System
- Dashboard Analytics

## API Flow States

- `continue`: Continue with the current API conversation
- `next_api`: Switch to the next API endpoint
- `close_chat`: End the chat session
- `rom_api`: Initiate ROM analysis (video processing)
- `dashboard_api`: Generate final assessment dashboard

## Setup & Running

1. **Database Migration**

2. **Run Application**

3. **API Documentation**

## Dependencies

- Go 1.22.0
- Gin Web Framework
- PostgreSQL
- Swagger (API Documentation)

## Environment Variables

Create a `.env` file in the root directory with required configurations.

## Ignored Files

- /bin/
- *.exe
- *.out
- /vendor/
- .env
