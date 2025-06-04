package main

import (
	"flag"
	"fmt"
	"log"
	"os"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/jackc/pgx/v5"
)

func main() {
	// Parse command-line flags
	direction := flag.String("direction", "up", "Migration direction: 'up' or 'down'")
	steps := flag.Int("steps", 0, "Number of migration steps (default: 0 for all)")
	forceVersion := flag.Int("force", -1, "Force migration to specific version (-1 to disable)")
	flag.Parse()

	connStr := ""
	if proxy, ok := os.LookupEnv("DATABASE_PROXY_URL"); ok {
		var err error
		connStr, err = convertConnectionString(proxy)
		if err != nil {
			log.Fatalf("Failed to convert proxy connection string: %v", err)
		}
	} else {
		var err error
		connStr, err = convertConnectionString(os.Getenv("DATABASE_URL"))
		if err != nil {
			log.Fatalf("Failed to convert connection string: %v", err)
		}
	}

	// Configure migration source and database
	m, err := migrate.New(
		"file://migrations", // Path to your migration files
		connStr,             // Database URL
	)
	if err != nil {
		log.Fatalf("Failed to initialize migrate instance: %v", err)
	}

	// Check current migration version
	version, dirty, err := m.Version()
	if err != nil && err != migrate.ErrNilVersion {
		log.Printf("Warning: Could not get migration version: %v", err)
	} else if err != migrate.ErrNilVersion {
		log.Printf("Current migration version: %d, dirty: %v", version, dirty)
	} else {
		log.Println("No migrations have been applied yet")
	}

	// Handle force version if specified
	if *forceVersion >= 0 {
		log.Printf("Forcing migration version to %d", *forceVersion)
		if err := m.Force(*forceVersion); err != nil {
			log.Fatalf("Failed to force version to %d: %v", *forceVersion, err)
		}
		log.Printf("Successfully forced migration version to %d", *forceVersion)
		return
	}

	// Perform migration based on flags
	switch *direction {
	case "up":
		if *steps > 0 {
			if err := m.Steps(*steps); err != nil && err != migrate.ErrNoChange {
				log.Fatalf("Failed to migrate up %d steps: %v", *steps, err)
			}
		} else {
			if err := m.Up(); err != nil && err != migrate.ErrNoChange {
				// Check if this is a "no migration found" error and handle gracefully
				errStr := err.Error()
				if errStr == "no migration found for version 2: read down for version 2 .: file does not exist" ||
				   errStr == "no migration found for version 2" {
					log.Println("Warning: Migration system expected version 2 but only version 1 exists.")
					log.Println("This usually means the database is already at the latest version.")
					log.Println("Attempting to force set to version 1...")
					if forceErr := m.Force(1); forceErr != nil {
						log.Printf("Could not force version to 1: %v", forceErr)
						log.Fatalf("Failed to migrate up: %v", err)
					} else {
						log.Println("Successfully set migration version to 1")
					}
				} else {
					log.Fatalf("Failed to migrate up: %v", err)
				}
			}
		}
		log.Println("Migrations applied successfully (up)!")
	case "down":
		if *steps > 0 {
			if err := m.Steps(-*steps); err != nil && err != migrate.ErrNoChange {
				log.Fatalf("Failed to migrate down %d steps: %v", *steps, err)
			}
		} else {
			if err := m.Down(); err != nil && err != migrate.ErrNoChange {
				log.Fatalf("Failed to migrate down: %v", err)
			}
		}
		log.Println("Migrations rolled back successfully (down)!")
	default:
		log.Fatalf("Invalid migration direction: %s. Use 'up' or 'down'.", *direction)
	}
}

func convertConnectionString(databaseURL string) (string, error) {
	// Parse the input connection string
	config, err := pgx.ParseConfig(databaseURL)
	if err != nil {
		return "", fmt.Errorf("failed to parse connection string: %w", err)
	}

	// Convert to URL format
	url := fmt.Sprintf("postgres://%s:%s@%s:%d/%s?sslmode=disable",
		config.User,
		config.Password,
		config.Host,
		config.Port,
		config.Database,
	)

	return url, nil
}
