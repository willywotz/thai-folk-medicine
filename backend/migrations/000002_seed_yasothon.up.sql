INSERT INTO province (name_thai, name_english)
VALUES ('ยโสธร', 'Yasothon');

INSERT INTO district (province_id, name_thai, name_english)
SELECT p.id, seed.name_thai, seed.name_english
FROM province p
CROSS JOIN (
    VALUES
        ('เมืองยโสธร', 'Mueang Yasothon'),
        ('ทรายมูล', 'Sai Mun'),
        ('กุดชุม', 'Kut Chum'),
        ('คำเขื่อนแก้ว', 'Kham Khuean Kaeo'),
        ('ป่าติ้ว', 'Pa Tio'),
        ('มหาชนะชัย', 'Maha Chana Chai'),
        ('ค้อวัง', 'Kho Wang'),
        ('เลิงนกทา', 'Loeng Nok Tha'),
        ('ไทยเจริญ', 'Thai Charoen')
) AS seed (name_thai, name_english)
WHERE p.name_english = 'Yasothon';
