How to Run the Application
Backend Setup

Set up PostgreSQL database:

# Create a PostgreSQL database

createdb aibot

Set the environment variables:

# Create .env file in the backend directory

echo "DATABASE_URL=postgres://postgres:postgres@localhost:5432/aibot?sslmode=disable" > backend/.env

Run database migrations:
cd backend
go run cmd/migrate/main.go --direction=up

Run the backend server:
cd backend
go run cmd/app/main.go

Frontend Setup

Install dependencies:
cd frontend
npm install

Start the development server:
npm start

The error "no migration found for version 3: read down for version 3" suggests that there might be some inconsistency in the migration state tracking. This typically happens when:

The migration version sequence in the database doesn't match the files in your migrations directory
There might be some leftover migration entries in the database's migration table

Here's how to resolve this issue:

Check existing migrations in the database:
psql -d aibot -c "SELECT \* FROM schema_migrations;"
This will show you what migration versions are already recorded in the database.
Reset the migrations (if possible):
go run cmd/migrate/main.go --direction=down
This might fail with the same error, but it's worth trying.
Create a new migration file with version 3:
migrate create -ext sql -dir migrations -seq additional_schema
This will create version 3 migration files.
Alternative approach - Force migration version:
You can try to force the migration version to match your files:

# Using golang-migrate CLI if installed

migrate -path ./migrations -database "postgres://postgres:postgres@localhost:5432/aibot?sslmode=disable" force 1

# Then try your original command again

go run cmd/migrate/main.go --direction=up

Check if the database exists and is properly configured:
Make sure the database exists and your DATABASE_URL in the .env file is correct.

If these approaches don't work, you might need to manually inspect and fix the migration table in your database, or in extreme cases, drop and recreate the database to start fresh:
dropdb aibot
createdb aibot
go run cmd/migrate/main.go --direction=up
Let me know if you need further assistance with this migration issue!
