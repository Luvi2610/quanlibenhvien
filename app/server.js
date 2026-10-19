const express = require('express');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Cấu hình kết nối PostgreSQL
const pool = new Pool({
  user: process.env.POSTGRES_USER || 'admin',
  host: process.env.POSTGRES_HOST || 'db',
  database: process.env.POSTGRES_DB || 'clinic_management',
  password: process.env.POSTGRES_PASSWORD || 'StrongPassword123!',
  port: 5432,
});

// Tự động tạo bảng nếu chưa tồn tại khi khởi chạy
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS patients (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        age INT NOT NULL,
        gender VARCHAR(10),
        phone VARCHAR(20),
        symptom TEXT,
        doctor VARCHAR(100),
        appointment_date DATE
      );
    `);
    console.log("Khởi tạo bảng 'patients' thành công trong PostgreSQL.");
  } catch (err) {
    console.error("Lỗi khởi tạo DB:", err.message);
  }
}
initDB();

// API /metrics phục vụ Prometheus monitoring
app.get('/metrics', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(`# HELP clinic_app_up Trạng thái ứng dụng\nclinic_app_up 1\n`);
});

// Trang chủ hiển thị giao diện Quản lý Bệnh nhân & Lịch khám
app.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM patients ORDER BY id DESC');
    const patients = result.rows;

    let tableRows = patients.map(p => `
      <tr>
        <td>${p.id}</td>
        <td><strong>${p.name}</strong></td>
        <td>${p.age}</td>
        <td>${p.gender}</td>
        <td>${p.phone}</td>
        <td>${p.symptom || 'Kham dinh ky'}</td>
        <td><span class="badge bg-info text-dark">BS. ${p.doctor || 'Chua phan cong'}</span></td>
        <td>${p.appointment_date ? new Date(p.appointment_date).toLocaleDateString('vi-VN') : 'Trong ngay'}</td>
        <td>
          <form action="/delete/${p.id}" method="POST" style="display:inline;">
            <button type="submit" class="btn btn-sm btn-danger" onclick="return confirm('Xac nhan xoa benh nhan nay?')">Xóa</button>
          </form>
        </td>
      </tr>
    `).join('');

    const html = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Hệ thống Quản lý Phòng khám - Đề 8</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
      <style>
        body { background-color: #f4f6f9; }
        .navbar-brand { font-weight: bold; }
        .card { border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
      </style>
    </head>
    <body>
      <nav class="navbar navbar-expand-lg navbar-dark bg-primary mb-4">
        <div class="container">
          <a class="navbar-brand" href="#">🏥 BỆNH VIỆN / PHÒNG KHÁM ĐA KHOA (ĐỀ 8)</a>
          <span class="navbar-text text-white">Trạng thái hệ thống: <span class="badge bg-success">ONLINE</span></span>
        </div>
      </nav>

      <div class="container">
        <div class="row">
          <!-- Form đăng ký lịch khám -->
          <div class="col-md-4 mb-4">
            <div class="card p-3">
              <h5 class="card-title text-primary">📋 Đăng Ký Khám Bệnh</h5>
              <hr>
              <form action="/add" method="POST">
                <div class="mb-3">
                  <label class="form-label">Họ và Tên Bệnh Nhân</label>
                  <input type="text" name="name" class="form-control" placeholder="Nguyễn Văn A" required>
                </div>
                <div class="row mb-3">
                  <div class="col">
                    <label class="form-label">Tuổi</label>
                    <input type="number" name="age" class="form-control" placeholder="30" required>
                  </div>
                  <div class="col">
                    <label class="form-label">Giới tính</label>
                    <select name="gender" class="form-select">
                      <option value="Nam">Nam</option>
                      <option value="Nữ">Nữ</option>
                    </select>
                  </div>
                </div>
                <div class="mb-3">
                  <label class="form-label">Số Điện Thoại</label>
                  <input type="text" name="phone" class="form-control" placeholder="0987654321" required>
                </div>
                <div class="mb-3">
                  <label class="form-label">Triệu Chứng / Lý Do Khám</label>
                  <textarea name="symptom" class="form-control" rows="2" placeholder="Đau đầu, sốt nhẹ..."></textarea>
                </div>
                <div class="mb-3">
                  <label class="form-label">Bác Sĩ Phụ Trách</label>
                  <select name="doctor" class="form-select">
                    <option value="Nguyễn Văn Khoa (Nội khoa)">BS. Nguyễn Văn Khoa (Nội khoa)</option>
                    <option value="Lê Thị Mai (Nhi khoa)">BS. Lê Thị Mai (Nhi khoa)</option>
                    <option value="Trần Đức Anh (Ngoại khoa)">BS. Trần Đức Anh (Ngoại khoa)</option>
                  </select>
                </div>
                <div class="mb-3">
                  <label class="form-label">Ngày Khám</label>
                  <input type="date" name="appointment_date" class="form-control" required>
                </div>
                <button type="submit" class="btn btn-primary w-100">Thêm Bệnh Nhân & Đặt Lịch</button>
              </form>
            </div>
          </div>

          <!-- Bảng danh sách bệnh nhân -->
          <div class="col-md-8">
            <div class="card p-3">
              <h5 class="card-title text-success">🩺 Danh Sách Lịch Khám & Bệnh Nhân</h5>
              <hr>
              <div class="table-responsive">
                <table class="table table-hover align-middle">
                  <thead class="table-light">
                    <tr>
                      <th>STT</th>
                      <th>Bệnh Nhân</th>
                      <th>Tuổi</th>
                      <th>Giới Tính</th>
                      <th>SĐT</th>
                      <th>Triệu Chứng</th>
                      <th>Bác Sĩ Khám</th>
                      <th>Ngày Khám</th>
                      <th>Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${tableRows.length > 0 ? tableRows : '<tr><td colspan="9" class="text-center text-muted">Chưa có dữ liệu bệnh nhân. Hãy nhập thông tin bên trái để thêm mới!</td></tr>'}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
    `;
    res.send(html);
  } catch (err) {
    res.status(500).send("Lỗi kết nối cơ sở dữ liệu: " + err.message);
  }
});

// Chức năng Thêm Bệnh nhân
app.post('/add', async (req, res) => {
  const { name, age, gender, phone, symptom, doctor, appointment_date } = req.body;
  try {
    await pool.query(
      'INSERT INTO patients (name, age, gender, phone, symptom, doctor, appointment_date) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [name, age, gender, phone, symptom, doctor, appointment_date]
    );
    console.log(`Đã thêm bệnh nhân: ${name}`);
    res.redirect('/');
  } catch (err) {
    res.status(500).send("Lỗi thêm dữ liệu: " + err.message);
  }
});

// Chức năng Xóa Bệnh nhân
app.post('/delete/:id', async (req, res) => {
  const id = req.params.id;
  try {
    await pool.query('DELETE FROM patients WHERE id = $1', [id]);
    console.log(`Đã xóa bệnh nhân ID: ${id}`);
    res.redirect('/');
  } catch (err) {
    res.status(500).send("Lỗi xóa dữ liệu: " + err.message);
  }
});

app.listen(PORT, () => {
  console.log(`Website Quản lý Phòng khám đang chạy tại cổng ${PORT}`);
});