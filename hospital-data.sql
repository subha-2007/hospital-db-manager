create database hospital;
use hospital;
CREATE TABLE donors (
  donor_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  blood_group ENUM('A+','A-','B+','B-','AB+','AB-','O+','O-') NOT NULL,
  phone VARCHAR(15) UNIQUE,
  city VARCHAR(50),
  last_donation_date DATE
);

CREATE TABLE donations (
  donation_id INT AUTO_INCREMENT PRIMARY KEY,
  donor_id INT NOT NULL,
  donation_date DATE NOT NULL,
  volume_ml INT CHECK (volume_ml BETWEEN 350 AND 500),
  FOREIGN KEY (donor_id) REFERENCES donors(donor_id)
);

CREATE TABLE blood_units (
  unit_id INT AUTO_INCREMENT PRIMARY KEY,
  donation_id INT NOT NULL UNIQUE,
  blood_group VARCHAR(3) NOT NULL,
  collected_on DATE NOT NULL,
  expiry_date DATE NOT NULL,
  status ENUM('Available','Issued','Expired') DEFAULT 'Available',
  FOREIGN KEY (donation_id) REFERENCES donations(donation_id)
);

CREATE TABLE hospitals (
  hospital_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  city VARCHAR(50),
  phone VARCHAR(15)
);

CREATE TABLE requests (
  request_id INT AUTO_INCREMENT PRIMARY KEY,
  hospital_id INT NOT NULL,
  blood_group VARCHAR(3) NOT NULL,
  units_needed INT CHECK (units_needed > 0),
  request_date DATE NOT NULL,
  status ENUM('Pending','Fulfilled') DEFAULT 'Pending',
  FOREIGN KEY (hospital_id) REFERENCES hospitals(hospital_id)
);

CREATE TABLE issues (
  issue_id INT AUTO_INCREMENT PRIMARY KEY,
  request_id INT NOT NULL,
  unit_id INT NOT NULL UNIQUE,
  issue_date DATE NOT NULL,
  FOREIGN KEY (request_id) REFERENCES requests(request_id),
  FOREIGN KEY (unit_id) REFERENCES blood_units(unit_id)
);

CREATE TABLE blood_compatibility (
  donor_group VARCHAR(3),
  recipient_group VARCHAR(3),
  PRIMARY KEY (donor_group, recipient_group)
);
use hospital;
INSERT INTO donors (name, blood_group, phone, city, last_donation_date) VALUES
('Aarav Sharma', 'O+',  '9810000001', 'Ghaziabad', CURDATE() - INTERVAL 30 DAY),
('Priya Singh',  'A+',  '9810000002', 'Delhi',     CURDATE() - INTERVAL 28 DAY),
('Rohan Verma',  'B+',  '9810000003', 'Noida',     CURDATE() - INTERVAL 31 DAY),
('Sneha Gupta',  'O-',  '9810000004', 'Ghaziabad', CURDATE() - INTERVAL 20 DAY),
('Karan Mehta',  'AB+', '9810000005', 'Delhi',     CURDATE() - INTERVAL 18 DAY),
('Anjali Yadav', 'A-',  '9810000006', 'Meerut',    CURDATE() - INTERVAL 15 DAY),
('Vikram Joshi', 'B-',  '9810000007', 'Noida',     CURDATE() - INTERVAL 12 DAY),
('Neha Kapoor',  'O+',  '9810000008', 'Ghaziabad', CURDATE() - INTERVAL 10 DAY),
('Amit Tiwari',  'A+',  '9810000009', 'Delhi',     CURDATE() - INTERVAL 5 DAY),
('Pooja Rana',   'AB-', '9810000010', 'Noida',     CURDATE() - INTERVAL 3 DAY),
('Ravi Kumar',   'O+',  '9810000011', 'Ghaziabad', CURDATE() - INTERVAL 2 DAY),
('Isha Malik',   'B+',  '9810000012', 'Delhi',     CURDATE() - INTERVAL 40 DAY);
INSERT INTO hospitals (name, city, phone) VALUES
('City Care Hospital',  'Ghaziabad', '0120111111'),
('Apex Medical Centre', 'Delhi',     '0110222222'),
('Lifeline Hospital',   'Noida',     '0120333333');
INSERT INTO blood_compatibility (donor_group, recipient_group) VALUES
('O-','O-'),('O-','O+'),('O-','A-'),('O-','A+'),('O-','B-'),('O-','B+'),('O-','AB-'),('O-','AB+'),
('O+','O+'),('O+','A+'),('O+','B+'),('O+','AB+'),
('A-','A-'),('A-','A+'),('A-','AB-'),('A-','AB+'),
('A+','A+'),('A+','AB+'),
('B-','B-'),('B-','B+'),('B-','AB-'),('B-','AB+'),
('B+','B+'),('B+','AB+'),
('AB-','AB-'),('AB-','AB+'),
('AB+','AB+');
 
-- 4. DONATIONS (12 rows, donation_id 1-12 = donor_id 1-12) -------------------
INSERT INTO donations (donor_id, donation_date, volume_ml) VALUES
(1,  CURDATE() - INTERVAL 30 DAY, 450),
(2,  CURDATE() - INTERVAL 28 DAY, 450),
(3,  CURDATE() - INTERVAL 31 DAY, 350),
(4,  CURDATE() - INTERVAL 20 DAY, 450),
(5,  CURDATE() - INTERVAL 18 DAY, 450),
(6,  CURDATE() - INTERVAL 15 DAY, 400),
(7,  CURDATE() - INTERVAL 12 DAY, 450),
(8,  CURDATE() - INTERVAL 10 DAY, 450),
(9,  CURDATE() - INTERVAL 5 DAY,  450),
(10, CURDATE() - INTERVAL 3 DAY,  450),
(11, CURDATE() - INTERVAL 2 DAY,  450),
(12, CURDATE() - INTERVAL 40 DAY, 400);
 
-- 5. BLOOD_UNITS (12 rows, one per donation; expiry = collection + 35 days) ---
--    Unit 1 and 2 are already issued, unit 12 is expired, unit 3 expires in 4 days.
INSERT INTO blood_units (donation_id, blood_group, collected_on, expiry_date, status) VALUES
(1,  'O+',  CURDATE() - INTERVAL 30 DAY, CURDATE() + INTERVAL 5 DAY,  'Issued'),
(2,  'A+',  CURDATE() - INTERVAL 28 DAY, CURDATE() + INTERVAL 7 DAY,  'Issued'),
(3,  'B+',  CURDATE() - INTERVAL 31 DAY, CURDATE() + INTERVAL 4 DAY,  'Available'),
(4,  'O-',  CURDATE() - INTERVAL 20 DAY, CURDATE() + INTERVAL 15 DAY, 'Available'),
(5,  'AB+', CURDATE() - INTERVAL 18 DAY, CURDATE() + INTERVAL 17 DAY, 'Available'),
(6,  'A-',  CURDATE() - INTERVAL 15 DAY, CURDATE() + INTERVAL 20 DAY, 'Available'),
(7,  'B-',  CURDATE() - INTERVAL 12 DAY, CURDATE() + INTERVAL 23 DAY, 'Available'),
(8,  'O+',  CURDATE() - INTERVAL 10 DAY, CURDATE() + INTERVAL 25 DAY, 'Available'),
(9,  'A+',  CURDATE() - INTERVAL 5 DAY,  CURDATE() + INTERVAL 30 DAY, 'Available'),
(10, 'AB-', CURDATE() - INTERVAL 3 DAY,  CURDATE() + INTERVAL 32 DAY, 'Available'),
(11, 'O+',  CURDATE() - INTERVAL 2 DAY,  CURDATE() + INTERVAL 33 DAY, 'Available'),
(12, 'B+',  CURDATE() - INTERVAL 40 DAY, CURDATE() - INTERVAL 5 DAY,  'Expired');
 
INSERT INTO requests (hospital_id, blood_group, units_needed, request_date, status) VALUES
(1, 'A+',  1, CURDATE() - INTERVAL 4 DAY, 'Fulfilled'),
(2, 'B+',  2, CURDATE() - INTERVAL 1 DAY, 'Pending'),
(3, 'O-',  1, CURDATE(),                  'Pending'),
(1, 'O+',  1, CURDATE() - INTERVAL 6 DAY, 'Fulfilled'),
(2, 'AB+', 1, CURDATE(),                  'Pending');
 
-- 7. ISSUES (2 rows: the units given for the two fulfilled requests) ----------
INSERT INTO issues (request_id, unit_id, issue_date) VALUES
(1, 2, CURDATE() - INTERVAL 3 DAY),
(4, 1, CURDATE() - INTERVAL 5 DAY);
