DELETE FROM district
WHERE province_id IN (SELECT id FROM province WHERE name_english = 'Yasothon');

DELETE FROM province WHERE name_english = 'Yasothon';
