package repository

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	"github.com/willywotz/thai-folk-medicine/backend/internal/adapter/repository/db"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/remedy"
)

// Remedy stores and reads remedies in Postgres.
type Remedy struct {
	q *db.Queries
}

// NewRemedy builds the remedy repository.
func NewRemedy(q *db.Queries) *Remedy {
	return &Remedy{q: q}
}

func toRemedy(row db.Remedy) remedy.Remedy {
	return remedy.Remedy{
		ID:                row.ID,
		HealerID:          row.HealerID,
		Name:              row.Name,
		Symptoms:          row.Symptoms,
		Ingredients:       row.Ingredients,
		PreparationMethod: row.PreparationMethod,
		Usage:             row.Usage,
		Note:              row.Note,
		CreatedAt:         row.CreatedAt.Time,
		UpdatedAt:         row.UpdatedAt.Time,
	}
}

// Create inserts a remedy.
func (r *Remedy) Create(ctx context.Context, p remedy.CreateParams) (remedy.Remedy, error) {
	row, err := r.q.CreateRemedy(ctx, db.CreateRemedyParams{
		HealerID:          p.HealerID,
		Name:              p.Name,
		Symptoms:          p.Symptoms,
		Ingredients:       p.Ingredients,
		PreparationMethod: p.PreparationMethod,
		Usage:             p.Usage,
		Note:              p.Note,
	})
	if err != nil {
		return remedy.Remedy{}, err
	}
	return toRemedy(row), nil
}

// GetByID returns one remedy or remedy.ErrNotFound.
func (r *Remedy) GetByID(ctx context.Context, id int64) (remedy.Remedy, error) {
	row, err := r.q.GetRemedy(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return remedy.Remedy{}, remedy.ErrNotFound
		}
		return remedy.Remedy{}, err
	}
	return toRemedy(row), nil
}

// ListByHealer returns the remedies of one healer.
func (r *Remedy) ListByHealer(ctx context.Context, healerID int64) ([]remedy.Remedy, error) {
	rows, err := r.q.ListRemedyByHealer(ctx, healerID)
	if err != nil {
		return nil, err
	}
	result := make([]remedy.Remedy, 0, len(rows))
	for _, row := range rows {
		result = append(result, toRemedy(row))
	}
	return result, nil
}

// Update changes a remedy or returns remedy.ErrNotFound.
func (r *Remedy) Update(ctx context.Context, p remedy.UpdateParams) (remedy.Remedy, error) {
	row, err := r.q.UpdateRemedy(ctx, db.UpdateRemedyParams{
		ID:                p.ID,
		Name:              p.Name,
		Symptoms:          p.Symptoms,
		Ingredients:       p.Ingredients,
		PreparationMethod: p.PreparationMethod,
		Usage:             p.Usage,
		Note:              p.Note,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return remedy.Remedy{}, remedy.ErrNotFound
		}
		return remedy.Remedy{}, err
	}
	return toRemedy(row), nil
}

// Delete removes a remedy, or returns remedy.ErrNotFound / remedy.ErrReferenced.
func (r *Remedy) Delete(ctx context.Context, id int64) error {
	rows, err := r.q.DeleteRemedy(ctx, id)
	if err != nil {
		if isForeignKeyViolation(err) {
			return remedy.ErrReferenced
		}
		return err
	}
	if rows == 0 {
		return remedy.ErrNotFound
	}
	return nil
}

// Search returns remedies whose name, symptoms, or ingredients match the term.
func (r *Remedy) Search(ctx context.Context, term string) ([]remedy.SearchResult, error) {
	rows, err := r.q.SearchRemedy(ctx, term)
	if err != nil {
		return nil, err
	}
	result := make([]remedy.SearchResult, 0, len(rows))
	for _, row := range rows {
		result = append(result, remedy.SearchResult{
			ID:             row.ID,
			Name:           row.Name,
			Symptoms:       row.Symptoms,
			Ingredients:    row.Ingredients,
			HealerID:       row.HealerID,
			HealerFullName: row.HealerFullName,
		})
	}
	return result, nil
}
