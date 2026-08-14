package repository

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/willywotz/thai-folk-medicine/backend/internal/adapter/repository/db"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/treatmentcase"
)

// TreatmentCase stores and reads treatment cases in Postgres.
type TreatmentCase struct {
	q *db.Queries
}

// NewTreatmentCase builds the treatment-case repository.
func NewTreatmentCase(q *db.Queries) *TreatmentCase {
	return &TreatmentCase{q: q}
}

func toTreatmentCase(row db.TreatmentCase) treatmentcase.TreatmentCase {
	return treatmentcase.TreatmentCase{
		ID:         row.ID,
		RemedyID:   row.RemedyID,
		HealerID:   row.HealerID,
		PatientAge: int(row.PatientAge),
		PatientSex: row.PatientSex,
		Symptoms:   row.Symptoms,
		Result:     row.Result,
		Note:       row.Note,
		TreatedOn:  row.TreatedOn.Time,
		CreatedAt:  row.CreatedAt.Time,
		UpdatedAt:  row.UpdatedAt.Time,
	}
}

func dateOf(t time.Time) pgtype.Date {
	return pgtype.Date{Time: t, Valid: true}
}

// Create inserts a treatment case.
func (r *TreatmentCase) Create(ctx context.Context, p treatmentcase.CreateParams) (treatmentcase.TreatmentCase, error) {
	row, err := r.q.CreateTreatmentCase(ctx, db.CreateTreatmentCaseParams{
		RemedyID:   p.RemedyID,
		HealerID:   p.HealerID,
		PatientAge: int32(p.PatientAge),
		PatientSex: p.PatientSex,
		Symptoms:   p.Symptoms,
		Result:     p.Result,
		Note:       p.Note,
		TreatedOn:  dateOf(p.TreatedOn),
	})
	if err != nil {
		return treatmentcase.TreatmentCase{}, err
	}
	return toTreatmentCase(row), nil
}

// GetByID returns one case or treatmentcase.ErrNotFound.
func (r *TreatmentCase) GetByID(ctx context.Context, id int64) (treatmentcase.TreatmentCase, error) {
	row, err := r.q.GetTreatmentCase(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return treatmentcase.TreatmentCase{}, treatmentcase.ErrNotFound
		}
		return treatmentcase.TreatmentCase{}, err
	}
	return toTreatmentCase(row), nil
}

// ListByRemedy returns the cases for one remedy.
func (r *TreatmentCase) ListByRemedy(ctx context.Context, remedyID int64) ([]treatmentcase.TreatmentCase, error) {
	rows, err := r.q.ListTreatmentCaseByRemedy(ctx, remedyID)
	if err != nil {
		return nil, err
	}
	result := make([]treatmentcase.TreatmentCase, 0, len(rows))
	for _, row := range rows {
		result = append(result, toTreatmentCase(row))
	}
	return result, nil
}

// ListRecent returns the most recently treated cases.
func (r *TreatmentCase) ListRecent(ctx context.Context, limit int32) ([]treatmentcase.TreatmentCase, error) {
	rows, err := r.q.ListRecentTreatmentCase(ctx, limit)
	if err != nil {
		return nil, err
	}
	result := make([]treatmentcase.TreatmentCase, 0, len(rows))
	for _, row := range rows {
		result = append(result, toTreatmentCase(row))
	}
	return result, nil
}

// Update changes a case or returns treatmentcase.ErrNotFound.
func (r *TreatmentCase) Update(ctx context.Context, p treatmentcase.UpdateParams) (treatmentcase.TreatmentCase, error) {
	row, err := r.q.UpdateTreatmentCase(ctx, db.UpdateTreatmentCaseParams{
		ID:         p.ID,
		PatientAge: int32(p.PatientAge),
		PatientSex: p.PatientSex,
		Symptoms:   p.Symptoms,
		Result:     p.Result,
		Note:       p.Note,
		TreatedOn:  dateOf(p.TreatedOn),
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return treatmentcase.TreatmentCase{}, treatmentcase.ErrNotFound
		}
		return treatmentcase.TreatmentCase{}, err
	}
	return toTreatmentCase(row), nil
}

// Delete removes a case or returns treatmentcase.ErrNotFound.
func (r *TreatmentCase) Delete(ctx context.Context, id int64) error {
	rows, err := r.q.DeleteTreatmentCase(ctx, id)
	if err != nil {
		return err
	}
	if rows == 0 {
		return treatmentcase.ErrNotFound
	}
	return nil
}
