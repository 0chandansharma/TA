package services

import (
	"ai-bot-deecogs/internal/db"
	"context"
	"encoding/json"
	"errors"
	"log"
	"time"
)

type RangeOfMotion struct {
	Minimum json.Number `json:"minimum"`
	Maximum json.Number `json:"maximum"`
}

type ROMRequest struct {
	RangeOfMotion RangeOfMotion `json:"rangeOfMotion"` // Store JSONB data
}

type ROMDataResponse struct {
	RomID        uint32          `json:"romId"`
	AssessmentID uint32          `json:"assessmentId"`
	RangeOfMotion RangeOfMotion `json:"rangeOfMotion"`
	CreatedAt    time.Time          `json:"createdAt"`
}

type ROMDataResponseCleaned struct {
	RomID        uint32          `json:"romId"`
	AssessmentID uint32          `json:"assessmentId"`
	RangeOfMotion RangeOfMotion `json:"rangeOfMotion"`
	CreatedAt    time.Time          `json:"createdAt"`
}

// SubmitROMAnalysis stores pose model data and analysis results for an assessment
func SubmitROMAnalysis(assessmentId uint32, rangeOfMotion RangeOfMotion) (APIResponse, error) {
	var aiResponse APIResponse

	payload:= ROMRequest{RangeOfMotion: rangeOfMotion}
	jsonData, marshalErr := json.Marshal(payload)
	if marshalErr != nil {
		return aiResponse, marshalErr
	}

	query := `
		INSERT INTO rom_analysis (assessment_id, pose_model_data, created_at)
		VALUES ($1, $2, NOW())
	`
	_, err := db.DB.Exec(context.Background(), query, assessmentId, jsonData )
	if err != nil {
		return aiResponse, err
	}

	return aiResponse, nil
}

// GetROMAnalysis retrieves ROM analysis data for a given assessment
func GetROMAnalysisByAssessmentId(assessmentID uint32) (*ROMDataResponse, error) {
	// var apiResponse ROMDataResponseCleaned
	query := `
		SELECT rom_id, assessment_id, pose_model_data, created_at
		FROM rom_analysis
		WHERE assessment_id = $1 order by created_at desc limit 1
	`

	var romData ROMDataResponse
	// var PoseModelData RangeOfMotion

	// var unmarshalRomData = json.Unmarshal([]byte(romData.RangeOfMotion), &romData.RangeOfMotion)
	// log.Printf("Unmarshalled ROM Data: %v", unmarshalRomData)

	var poseModelDataRaw json.RawMessage

	err := db.DB.QueryRow(context.Background(), query, assessmentID).Scan(
		&romData.RomID,
		&romData.AssessmentID,
		&poseModelDataRaw,
		&romData.CreatedAt,
	)

	if err != nil {
		return nil, err
	}

	// romData.RangeOfMotion.UnmarshalJSON(romData.RangeOfMotion)

	// romParsed := json.Unmarshal(json.Marshal()romData.RangeOfMotion)
	// log.Printf("ROM Data: %v", romParsed)

	// if err := json.Unmarshal(romData.RangeOfMotion, &PoseModelData); err != nil {
	// 	log.Println("Failed to parse range of motion JSON:", err)
	// 	return romData, err
	// }

	// Step 1: Convert Raw JSON to Map
	var poseModelData map[string]json.RawMessage
	if err := json.Unmarshal(poseModelDataRaw, &poseModelData); err != nil {
		log.Println("Failed to parse outer poseModelData JSON:", err)
		return nil, err
	}
	// Step 2: Extract Inner `rangeOfMotion` JSON
	var rangeOfMotion RangeOfMotion
	if rawInner, exists := poseModelData["rangeOfMotion"]; exists {
		if err := json.Unmarshal(rawInner, &rangeOfMotion); err != nil {
			log.Println("Failed to parse inner rangeOfMotion JSON:", err)
			return nil, err
		}
	} else {
		log.Println("Inner rangeOfMotion key missing")
		return nil, errors.New("rangeOfMotion format incorrect")
	}

	return &ROMDataResponse{
		RomID: romData.RomID,
		AssessmentID: romData.AssessmentID,
		RangeOfMotion: rangeOfMotion,
		CreatedAt: romData.CreatedAt,
	}, nil
}
