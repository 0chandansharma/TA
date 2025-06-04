#!/bin/bash

# Add Google OAuth and API dependencies
go get golang.org/x/oauth2
go get golang.org/x/oauth2/google
go get google.golang.org/api/option

echo "Google OAuth dependencies added successfully!"