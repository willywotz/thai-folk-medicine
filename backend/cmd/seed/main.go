// Command seed fills an empty demo database with generated Thai folk-medicine
// data (healers, remedies, treatment cases, and a few placeholder photos).
// It writes through the repository ports and never runs unless invoked, so a
// real production database stays clean.
package main

import (
	"bytes"
	"context"
	"flag"
	"log/slog"
	"math/rand"
	"os"
	"time"

	"github.com/willywotz/thai-folk-medicine/backend/internal/adapter/repository"
	"github.com/willywotz/thai-folk-medicine/backend/internal/adapter/repository/db"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/herb"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/photo"
	"github.com/willywotz/thai-folk-medicine/backend/internal/platform/config"
	"github.com/willywotz/thai-folk-medicine/backend/internal/platform/database"
	"github.com/willywotz/thai-folk-medicine/backend/internal/platform/photostore"
)

const (
	healerCount = 50
	minRemedy   = 3
	maxRemedy   = 10
	minCase     = 3
	maxCase     = 10
	maxPhotoCountPerOwner = 5
	randomSeed  = 42
)

func main() {
	reset := flag.Bool("reset", false, "truncate demo tables before seeding")
	flag.Parse()

	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	if err := run(context.Background(), logger, *reset); err != nil {
		logger.Error("seed", "error", err)
		os.Exit(1)
	}
}

func run(ctx context.Context, logger *slog.Logger, reset bool) error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	if err := database.Migrate(cfg.DatabaseURL); err != nil {
		return err
	}
	pool, err := database.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer pool.Close()

	if reset {
		// withinlazy: leaves old photo files orphaned on disk; sweep PHOTO_STORAGE_DIR
		// manually if it matters. Demo tool only, so orphaned placeholder jpgs are harmless.
		if _, err := pool.Exec(ctx, `TRUNCATE photo, treatment_case, remedy_herb, remedy, herb, healer RESTART IDENTITY CASCADE`); err != nil {
			return err
		}
		logger.Info("demo tables truncated")
	}

	var existing int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM healer`).Scan(&existing); err != nil {
		return err
	}
	if existing > 0 {
		logger.Info("healer table not empty; nothing seeded (use -reset to overwrite)", "count", existing)
		return nil
	}

	queries := db.New(pool)
	locationRepo := repository.NewLocation(queries)
	healerRepo := repository.NewHealer(queries)
	herbRepo := repository.NewHerb(queries)
	remedyRepo := repository.NewRemedy(pool)
	caseRepo := repository.NewTreatmentCase(queries)
	photoRepo := repository.NewPhoto(queries)

	store, err := photostore.NewLocal(cfg.PhotoStorageDir)
	if err != nil {
		return err
	}

	provinces, err := locationRepo.ListProvince(ctx)
	if err != nil {
		return err
	}
	if len(provinces) == 0 {
		logger.Error("no province seeded; run migrations first")
		return nil
	}
	districts, err := locationRepo.ListDistrictByProvince(ctx, provinces[0].ID)
	if err != nil {
		return err
	}
	if len(districts) == 0 {
		logger.Error("no district seeded")
		return nil
	}

	rng := rand.New(rand.NewSource(randomSeed))
	now := time.Now()

	var photoCount int

	herbIDs := make([]int64, 0, len(herbSeedPool))
	for i, hs := range herbSeedPool {
		hb, err := herbRepo.Create(ctx, herb.CreateParams{
			NameThai:       hs.NameThai,
			NameEnglish:    hs.NameEnglish,
			ScientificName: hs.ScientificName,
			Properties:     hs.Properties,
			Description:    "สมุนไพรพื้นบ้าน",
		})
		if err != nil {
			return err
		}
		herbIDs = append(herbIDs, hb.ID)

		// Attach a placeholder photo to the first few herbs.
		if i < maxPhotoCountPerOwner {
			key, err := store.Save(ctx, bytes.NewReader(placeholderJPEG(int(hb.ID)*11)), ".jpg")
			if err != nil {
				return err
			}
			if _, err := photoRepo.Create(ctx, photo.CreateParams{
				OwnerType: photo.OwnerHerb,
				OwnerID:   hb.ID,
				ObjectKey: key,
				Caption:   "ภาพตัวอย่างสมุนไพร",
			}); err != nil {
				return err
			}

			photoCount++
		}
	}
	logger.Info("herbs seeded", "count", len(herbIDs))

	var healers, remedies, cases, healerPhotos, remedyPhotos int
	for i := range healerCount {
		district := districts[i%len(districts)]
		h, err := healerRepo.Create(ctx, randomHealer(rng, district.ID))
		if err != nil {
			return err
		}
		healers++
		
		if healerPhotos < maxPhotoCountPerOwner {
			key, err := store.Save(ctx, bytes.NewReader(placeholderJPEG(int(h.ID)*13)), ".jpg")
			if err != nil {
				return err
			}
			if _, err := photoRepo.Create(ctx, photo.CreateParams{
				OwnerType: photo.OwnerHealer,
				OwnerID:   h.ID,
				ObjectKey: key,
				Caption:   "ภาพตัวอย่างหมอพื้นบ้าน",
			}); err != nil {
				return err
			}
			healerPhotos++
			photoCount++
		}

		nRemedy := minRemedy + rng.Intn(maxRemedy-minRemedy+1)
		for range nRemedy {
			rp := randomRemedy(rng, h.ID)
			rp.Herbs = pickHerbRefs(rng, herbIDs)
			rm, err := remedyRepo.Create(ctx, rp)
			if err != nil {
				return err
			}
			remedies++

			nCase := minCase + rng.Intn(maxCase-minCase+1)
			for range nCase {
				if _, err := caseRepo.Create(ctx, randomCase(rng, now, rm.ID, h.ID)); err != nil {
					return err
				}
				cases++
			}

			// Attach a placeholder photo to the first few remedies.
			if remedyPhotos < maxPhotoCountPerOwner {
				key, err := store.Save(ctx, bytes.NewReader(placeholderJPEG(int(rm.ID)*37)), ".jpg")
				if err != nil {
					return err
				}
				if _, err := photoRepo.Create(ctx, photo.CreateParams{
					OwnerType: photo.OwnerRemedy,
					OwnerID:   rm.ID,
					ObjectKey: key,
					Caption:   "ภาพตัวอย่างตำรับยา",
				}); err != nil {
					return err
				}
				remedyPhotos++
				photoCount++
			}
		}

		remedyPhotos = 0
	}

	logger.Info("seed complete", "healers", healers, "remedies", remedies, "cases", cases, "photos", photoCount)
	return nil
}
