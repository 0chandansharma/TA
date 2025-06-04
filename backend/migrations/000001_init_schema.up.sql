CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE anatomy (
    anatomy_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE, -- Name of the body part (e.g., "Knee", "Shoulder")
    description TEXT, -- Optional description of the anatomy
    category VARCHAR(255), -- Optional category (e.g., "Upper Limb", "Lower Limb")
    subcategory VARCHAR(255), -- Optional subcategory (e.g., "Arm", "Leg")
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE assessments (
    assessment_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    anatomy_id INTEGER NOT NULL REFERENCES anatomy(anatomy_id) ON DELETE CASCADE,
    assessment_type VARCHAR(50) NOT NULL CHECK (
        assessment_type IN ('PAIN', 'INJURY', 'FRACTURE', 'SWELLING', 'STIFFNESS', 'WEAKNESS', 'DISLOCATION', 'RECOVERY', 'GENERAL', 'OTHER')
    ), -- Type of assessment
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP,
    status VARCHAR(50) NOT NULL CHECK (status IN ('started', 'in_progress', 'completed', 'abandoned')),
    chat_history JSONB, -- Stores chat history with the user
    completion_percentage NUMERIC(5, 2) DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100)
);


CREATE TABLE questionnaires (
    question_id SERIAL PRIMARY KEY,
    assessment_id INTEGER NOT NULL REFERENCES assessments(assessment_id) ON DELETE CASCADE,
    chat_history JSONB, -- Stores question history with the user
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE rom_analysis (
    rom_id SERIAL PRIMARY KEY,
    assessment_id INTEGER NOT NULL REFERENCES assessments(assessment_id) ON DELETE CASCADE,
    pose_model_data JSONB NOT NULL, -- Stores pose data points for ROM
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ai_analysis (
    analysis_id SERIAL PRIMARY KEY,
    assessment_id INTEGER NOT NULL REFERENCES assessments(assessment_id) ON DELETE CASCADE,
    assessment_data JSONB NOT NULL, -- Stores assessment data for AI analysis
    analysed_results JSONB NOT NULL, -- Stores AI analysed results, including predicted conditions and metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE self_care_plans (
    plan_id SERIAL PRIMARY KEY,
    assessment_id INTEGER NOT NULL REFERENCES assessments(assessment_id) ON DELETE CASCADE,
    plan_name VARCHAR(255), -- Optional name for the care plan
    suggested_exercises JSONB NOT NULL, -- Stores exercises and related details
    critical_flag BOOLEAN DEFAULT FALSE, -- Indicates if physiotherapy is recommended
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE physio_calls (
    call_id SERIAL PRIMARY KEY,
    assessment_id INTEGER NOT NULL REFERENCES assessments(assessment_id) ON DELETE CASCADE,
    call_type VARCHAR(50) NOT NULL, -- Immediate or Scheduled
    call_status VARCHAR(50) NOT NULL CHECK (call_status IN ('scheduled', 'completed', 'cancelled')),
    scheduled_time TIMESTAMP, -- The time the call is scheduled
    initiated_by VARCHAR(50) CHECK (initiated_by IN ('user', 'system')), -- Indicates who initiated the call
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO users (user_id, name, email, password, created_at)
VALUES (
    1, -- Generates a random UUID
    'John',        -- Name of the user
    'john@example.com', -- Email address
    'password123',     -- Plain text password (consider hashing in real-world apps)
    NOW()              -- Current timestamp
);


INSERT INTO anatomy (anatomy_id, name, description, category, subcategory, created_at)
VALUES
    (1, 'Knee', 'Joint between the thigh and lower leg', 'Lower Limb', 'Leg', NOW()),
    (2, 'Shoulder', 'Joint connecting the arm to the torso', 'Upper Limb', 'Arm', NOW()),
    (3, 'Lower Back', 'Region of the spine between the ribs and pelvis', 'Spine', NULL, NOW());


INSERT INTO assessments (
    assessment_id, user_id, anatomy_id, assessment_type, start_time, end_time, status, completion_percentage
) VALUES (
    1, 
    1, -- Replace with an existing user ID from your users table
    1, -- Replace with an existing anatomy ID from your anatomy table
    'PAIN', 
    NOW(), 
    NULL, 
    'in_progress', 
    0
);

