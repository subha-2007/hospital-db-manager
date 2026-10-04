CREATE TYPE blood_group_type AS ENUM ('A+','A-','B+','B-','AB+','AB-','O+','O-');
CREATE TYPE unit_status AS ENUM ('Available','Issued','Expired');
CREATE TYPE request_status AS ENUM ('Pending','Fulfilled');

CREATE TABLE donors (
  donor_id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  blood_group blood_group_type NOT NULL,
  phone VARCHAR(15) UNIQUE,
  city VARCHAR(50),
  last_donation_date DATE
);

CREATE TABLE donations (
  donation_id SERIAL PRIMARY KEY,
  donor_id INT NOT NULL REFERENCES donors(donor_id),
  donation_date DATE NOT NULL,
  volume_ml INT CHECK (volume_ml BETWEEN 350 AND 500)
);

CREATE TABLE blood_units (
  unit_id SERIAL PRIMARY KEY,
  donation_id INT NOT NULL UNIQUE REFERENCES donations(donation_id),
  blood_group blood_group_type NOT NULL,
  collected_on DATE NOT NULL,
  expiry_date DATE NOT NULL,
  status unit_status DEFAULT 'Available'
);

CREATE TABLE hospitals (
  hospital_id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  city VARCHAR(50),
  phone VARCHAR(15)
);

CREATE TABLE requests (
  request_id SERIAL PRIMARY KEY,
  hospital_id INT NOT NULL REFERENCES hospitals(hospital_id),
  blood_group blood_group_type NOT NULL,
  units_needed INT CHECK (units_needed > 0),
  request_date DATE NOT NULL,
  status request_status DEFAULT 'Pending'
);

CREATE TABLE issues (
  issue_id SERIAL PRIMARY KEY,
  request_id INT NOT NULL REFERENCES requests(request_id),
  unit_id INT NOT NULL UNIQUE REFERENCES blood_units(unit_id),
  issue_date DATE NOT NULL
);

CREATE TABLE blood_compatibility (
  donor_group blood_group_type,
  recipient_group blood_group_type,
  PRIMARY KEY (donor_group, recipient_group)
);

INSERT INTO donors (name, blood_group, phone, city, last_donation_date) VALUES
('Aarav Sharma', 'O+',  '9810000001', 'Ghaziabad', CURRENT_DATE - 30),
('Priya Singh',  'A+',  '9810000002', 'Delhi',     CURRENT_DATE - 28),
('Rohan Verma',  'B+',  '9810000003', 'Noida',     CURRENT_DATE - 31),
('Sneha Gupta',  'O-',  '9810000004', 'Ghaziabad', CURRENT_DATE - 20),
('Karan Mehta',  'AB+', '9810000005', 'Delhi',     CURRENT_DATE - 18),
('Anjali Yadav', 'A-',  '9810000006', 'Meerut',    CURRENT_DATE - 15),
('Vikram Joshi', 'B-',  '9810000007', 'Noida',     CURRENT_DATE - 12),
('Neha Kapoor',  'O+',  '9810000008', 'Ghaziabad', CURRENT_DATE - 10),
('Amit Tiwari',  'A+',  '9810000009', 'Delhi',     CURRENT_DATE - 5),
('Pooja Rana',   'AB-', '9810000010', 'Noida',     CURRENT_DATE - 3),
('Ravi Kumar',   'O+',  '9810000011', 'Ghaziabad', CURRENT_DATE - 2),
('Isha Malik',   'B+',  '9810000012', 'Delhi',     CURRENT_DATE - 40);

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

INSERT INTO donations (donor_id, donation_date, volume_ml) VALUES
(1,  CURRENT_DATE - 30, 450),
(2,  CURRENT_DATE - 28, 450),
(3,  CURRENT_DATE - 31, 350),
(4,  CURRENT_DATE - 20, 450),
(5,  CURRENT_DATE - 18, 450),
(6,  CURRENT_DATE - 15, 400),
(7,  CURRENT_DATE - 12, 450),
(8,  CURRENT_DATE - 10, 450),
(9,  CURRENT_DATE - 5,  450),
(10, CURRENT_DATE - 3,  450),
(11, CURRENT_DATE - 2,  450),
(12, CURRENT_DATE - 40, 400);

INSERT INTO blood_units (donation_id, blood_group, collected_on, expiry_date, status) VALUES
(1,  'O+',  CURRENT_DATE - 30, CURRENT_DATE + 5,  'Issued'),
(2,  'A+',  CURRENT_DATE - 28, CURRENT_DATE + 7,  'Issued'),
(3,  'B+',  CURRENT_DATE - 31, CURRENT_DATE + 4,  'Available'),
(4,  'O-',  CURRENT_DATE - 20, CURRENT_DATE + 15, 'Available'),
(5,  'AB+', CURRENT_DATE - 18, CURRENT_DATE + 17, 'Available'),
(6,  'A-',  CURRENT_DATE - 15, CURRENT_DATE + 20, 'Available'),
(7,  'B-',  CURRENT_DATE - 12, CURRENT_DATE + 23, 'Available'),
(8,  'O+',  CURRENT_DATE - 10, CURRENT_DATE + 25, 'Available'),
(9,  'A+',  CURRENT_DATE - 5,  CURRENT_DATE + 30, 'Available'),
(10, 'AB-', CURRENT_DATE - 3,  CURRENT_DATE + 32, 'Available'),
(11, 'O+',  CURRENT_DATE - 2,  CURRENT_DATE + 33, 'Available'),
(12, 'B+',  CURRENT_DATE - 40, CURRENT_DATE - 5,  'Expired');

INSERT INTO requests (hospital_id, blood_group, units_needed, request_date, status) VALUES
(1, 'A+',  1, CURRENT_DATE - 4, 'Fulfilled'),
(2, 'B+',  2, CURRENT_DATE - 1, 'Pending'),
(3, 'O-',  1, CURRENT_DATE,     'Pending'),
(1, 'O+',  1, CURRENT_DATE - 6, 'Fulfilled'),
(2, 'AB+', 1, CURRENT_DATE,     'Pending');

INSERT INTO issues (request_id, unit_id, issue_date) VALUES
(1, 2, CURRENT_DATE - 3),
(4, 1, CURRENT_DATE - 5);
