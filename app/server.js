
const express = require('express');
const pool = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const PAGE_SIZE = 5;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Mã hóa dữ liệu để hạn chế XSS khi hiển thị HTML.
function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function layout(title, active, content) {
  const links = [
    ['/', 'gauge-high', 'Tổng quan'],
    ['/patients', 'users', 'Bệnh nhân'],
    ['/appointments', 'calendar-days', 'Lịch khám'],
    ['/doctors', 'user-doctor', 'Bác sĩ'],
    
  ];

  const nav = links.map(([url, icon, label]) => `
    <a class="nav-link ${active === url ? 'active' : ''}" href="${url}">
      <i class="fa-solid fa-${icon}"></i>
      <span>${label}</span>
    </a>
  `).join('');

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)} | Quản lý bệnh viện</title>

  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"
        rel="stylesheet">
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css"
        rel="stylesheet">

  <style>
    :root {
      --primary: #1769e0;
      --navy: #14243a;
      --bg: #f4f7fb;
      --muted: #718096;
      --border: #e5eaf2;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      background: var(--bg);
      color: #26354a;
      font-family: "Segoe UI", Arial, sans-serif;
    }

    .sidebar {
      position: fixed;
      inset: 0 auto 0 0;
      width: 245px;
      background: var(--navy);
      color: white;
      padding: 25px 16px;
      z-index: 10;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 0 10px 28px;
      font-size: 18px;
      font-weight: 750;
    }

    .brand-icon {
      width: 42px;
      height: 42px;
      display: grid;
      place-items: center;
      border-radius: 12px;
      background: var(--primary);
    }

    .nav-label {
      color: #91a2bb;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1px;
      padding: 12px;
      text-transform: uppercase;
    }

    .nav-link {
      display: flex;
      align-items: center;
      gap: 13px;
      color: #bdc9da;
      padding: 12px;
      margin: 4px 0;
      border-radius: 9px;
      text-decoration: none;
      transition: .2s;
    }

    .nav-link i {
      width: 20px;
      text-align: center;
    }

    .nav-link:hover,
    .nav-link.active {
      background: #24466e;
      color: white;
    }

    .main {
      margin-left: 245px;
      min-height: 100vh;
    }

    .topbar {
      min-height: 76px;
      background: white;
      border-bottom: 1px solid var(--border);
      padding: 18px 30px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 15px;
    }

    .page-content { padding: 28px 30px; }
    .muted { color: var(--muted); }

    .card {
      border: 1px solid var(--border);
      border-radius: 14px;
      box-shadow: 0 4px 18px rgba(30, 55, 90, .035);
    }

    .stat-card { height: 100%; padding: 21px; }

    .stat-icon {
      width: 46px;
      height: 46px;
      border-radius: 12px;
      display: grid;
      place-items: center;
      background: #eaf2ff;
      color: var(--primary);
      font-size: 20px;
    }

    .stat-value {
      font-size: 29px;
      font-weight: 750;
      margin: 9px 0 3px;
    }

    .form-control,
    .form-select {
      border-color: #dce3ed;
      border-radius: 8px;
      padding: 10px 12px;
    }

    .form-control:focus,
    .form-select:focus {
      border-color: #80b0ff;
      box-shadow: 0 0 0 .2rem rgba(23, 105, 224, .1);
    }

    .btn { border-radius: 8px; }
    .btn-primary { background: var(--primary); }
    .table { margin-bottom: 0; }

    .table thead th {
      background: #f7f9fc;
      color: #68778d;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: .3px;
      padding: 15px 12px;
      white-space: nowrap;
      border-bottom: 1px solid var(--border);
    }

    .table tbody td {
      padding: 14px 12px;
      border-color: var(--border);
      vertical-align: middle;
    }

    .table tbody tr:hover { background: #f8fbff; }

    .empty-state {
      padding: 40px 15px;
      text-align: center;
      color: var(--muted);
    }

    .empty-state i {
      font-size: 32px;
      margin-bottom: 12px;
      display: block;
    }

    .section-title { font-weight: 750; }

    .pagination .page-link { color: var(--primary); }

    .pagination .active .page-link {
      background: var(--primary);
      border-color: var(--primary);
      color: white;
    }

    .footer {
      padding: 20px 30px;
      color: var(--muted);
      font-size: 12px;
    }

    @media (max-width: 900px) {
      .sidebar {
        width: 68px;
        padding: 20px 8px;
      }

      .brand { padding: 0 4px 25px; }

      .brand-text,
      .nav-link span,
      .nav-label { display: none; }

      .nav-link { justify-content: center; }
      .main { margin-left: 68px; }

      .topbar,
      .page-content { padding: 18px 14px; }
    }
  </style>
</head>
<body>
  <aside class="sidebar">
    <div class="brand">
      <div class="brand-icon">
        <i class="fa-solid fa-hospital-user"></i>
      </div>
      <span class="brand-text">QL BỆNH VIỆN</span>
    </div>

    <div class="nav-label">QUẢN LÝ</div>
    <nav>${nav}</nav>

    <div class="nav-label mt-4">GIÁM SÁT</div>
    <a class="nav-link" href="http://localhost:3000/">
      <i class="fa-solid fa-server"></i>
      <span>Ứng dụng</span>
    </a>
  </aside>

  <main class="main">
    <header class="topbar">
      <div>
        <div class="muted small">HỆ THỐNG / QUẢN TRỊ</div>
        <h5 class="mb-0 mt-1 fw-bold">${esc(title)}</h5>
      </div>
      <span class="badge text-bg-success p-2">
        <i class="fa-solid fa-circle-check me-1"></i>
        Ứng dụng đang hoạt động
      </span>
    </header>

    
<div class="page-content">${content}</div>
<footer class="footer">
  Hệ thống quản lý phòng khám đa khoa · Dữ liệu PostgreSQL
</footer>
</main>
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>`;

}

function statCard(label, value, icon, color) {
  return `
    <div class="col-12 col-md-6 col-xl-4">
      <div class="card stat-card">
        <div class="d-flex justify-content-between align-items-start">
          <div>
            <div class="muted small">${esc(label)}</div>
            <div class="stat-value" style="color:${color}">
              ${esc(value)}
            </div>
          </div>
          <div class="stat-icon">
            <i class="fa-solid fa-${icon}"></i>
          </div>
        </div>
      </div>
    </div>`;
}

function validateDoctor(body) {
  const data = {
    name: String(body.name || '').trim(),
    specialty: String(body.specialty || '').trim(),
    phone: String(body.phone || '').trim(),
    email: String(body.email || '').trim() || null
  };

  if (!data.name || data.name.length > 150)
    return { error: 'Tên bác sĩ không hợp lệ.' };

  if (!data.specialty || data.specialty.length > 150)
    return { error: 'Chuyên khoa không hợp lệ.' };

  if (!data.phone || data.phone.length > 20)
    return { error: 'Số điện thoại không hợp lệ.' };

  if (
    data.email &&
    (data.email.length > 150 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))
  ) {
    return { error: 'Email không hợp lệ.' };
  }

  return { data };
}

async function renderPage(req, res) {
  try {
    const route = req.path;

    const titles = {
      '/': 'Tổng quan',
      '/patients': 'Quản lý bệnh nhân',
      '/appointments': 'Quản lý lịch khám',
      '/doctors': 'Quản lý bác sĩ',
      
    };

    const title = titles[route] || 'Tổng quan';
    const search = String(req.query.q || '').trim().slice(0, 100);

    const [pc, tc, dc] = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS total FROM patients'),
      pool.query(`
        SELECT COUNT(*)::int AS total
        FROM patients
        WHERE appointment_date::date = CURRENT_DATE
      `),
      pool.query('SELECT COUNT(*)::int AS total FROM doctors')
    ]);

    const patientCount = pc.rows[0].total;
    const todayCount = tc.rows[0].total;
    const doctorCount = dc.rows[0].total;

    let content = '';

    // QUẢN LÝ BÁC SĨ
    

if (route === '/doctors') {
  const params = [];
  let where = '';

  // Điều kiện tìm kiếm bác sĩ
  if (search) {
    params.push(`%${search}%`);
    where = `
      WHERE d.name ILIKE $1
         OR d.specialty ILIKE $1
         OR d.phone ILIKE $1
         OR COALESCE(d.email, '') ILIKE $1
    `;
  }

  // Đếm tổng số bác sĩ theo điều kiện tìm kiếm
  const countResult = await pool.query(`
    SELECT COUNT(*)::int AS total
    FROM doctors d
    ${where}
  `, params);

  const total = countResult.rows[0].total;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Đảm bảo số trang luôn hợp lệ
  const page = Math.min(
    Math.max(1, Number.parseInt(req.query.page, 10) || 1),
    pages
  );

  const offset = (page - 1) * PAGE_SIZE;

  // Lấy bác sĩ của trang hiện tại
  const listParams = [...params, PAGE_SIZE, offset];

  const result = await pool.query(`
  SELECT
    d.id,
    d.name,
    d.specialty,
    d.phone,
    d.email,
    COUNT(p.id)::int AS patient_count
  FROM doctors d
  LEFT JOIN patients p
    ON TRIM(COALESCE(p.doctor, '')) = TRIM(d.name)
  ${where}
  GROUP BY d.id, d.name, d.specialty, d.phone, d.email
  ORDER BY d.id ASC
  LIMIT $${listParams.length - 1}
  OFFSET $${listParams.length}
`, listParams);

  // Tạo các dòng dữ liệu
  const rows = result.rows.map(d => `
    <tr>
      <td>${d.id}</td>
      <td class="fw-semibold">${esc(d.name)}</td>
      <td>${esc(d.specialty || '—')}</td>
      <td>${esc(d.phone || '—')}</td>
      <td>${esc(d.email || '—')}</td>
      <td class="text-center">${d.patient_count}</td>
      <td>
        <div class="d-flex flex-wrap gap-2">
          <button
            type="button"
            class="btn btn-sm btn-outline-primary"
            data-bs-toggle="modal"
            data-bs-target="#editDoctor${d.id}">
            <i class="fa-solid fa-pen-to-square me-1"></i>
            Chỉnh sửa
          </button>

          <form
            action="/doctors/delete/${d.id}"
            method="POST"
            onsubmit="return confirm('Bạn có chắc muốn xóa bác sĩ này?')">
            <button type="submit" class="btn btn-sm btn-outline-danger">
              <i class="fa-solid fa-trash me-1"></i>
              Xóa
            </button>
          </form>
        </div>

        <div class="modal fade"
             id="editDoctor${d.id}"
             tabindex="-1"
             aria-hidden="true">
          <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content text-start">
              <form action="/doctors/update/${d.id}" method="POST">
                <div class="modal-header">
                  <h5 class="modal-title">Chỉnh sửa bác sĩ</h5>
                  <button type="button"
                          class="btn-close"
                          data-bs-dismiss="modal"
                          aria-label="Đóng"></button>
                </div>

                <div class="modal-body">
                  <div class="mb-3">
                    <label class="form-label">Họ và tên</label>
                    <input name="name"
                           class="form-control"
                           maxlength="150"
                           value="${esc(d.name)}"
                           required>
                  </div>

                  <div class="mb-3">
                    <label class="form-label">Chuyên khoa</label>
                    <input name="specialty"
                           class="form-control"
                           maxlength="150"
                           value="${esc(d.specialty || '')}"
                           required>
                  </div>

                  <div class="mb-3">
                    <label class="form-label">Số điện thoại</label>
                    <input name="phone"
                           class="form-control"
                           maxlength="20"
                           value="${esc(d.phone || '')}"
                           required>
                  </div>

                  <div class="mb-3">
                    <label class="form-label">Email</label>
                    <input name="email"
                           type="email"
                           class="form-control"
                           maxlength="150"
                           value="${esc(d.email || '')}">
                  </div>
                </div>

                <div class="modal-footer">
                  <button type="button"
                          class="btn btn-light"
                          data-bs-dismiss="modal">
                    Hủy
                  </button>
                  <button type="submit" class="btn btn-primary">
                    <i class="fa-solid fa-floppy-disk me-1"></i>
                    Lưu thay đổi
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </td>
    </tr>
  `).join('');

  // Giữ từ khóa tìm kiếm khi chuyển trang
  const queryString = `q=${encodeURIComponent(search)}`;

  // Phân trang
  const pagesHtml = pages > 1 ? `
    <nav class="mt-4" aria-label="Phân trang bác sĩ">
      <ul class="pagination justify-content-center flex-wrap">

        <li class="page-item ${page <= 1 ? 'disabled' : ''}">
          <a class="page-link"
             href="/doctors?page=${page - 1}&${queryString}">
            &laquo; Trước
          </a>
        </li>

        ${Array.from({ length: pages }, (_, i) => i + 1)
          .map(p => `
            <li class="page-item ${page === p ? 'active' : ''}">
              <a class="page-link"
                 href="/doctors?page=${p}&${queryString}">
                ${p}
              </a>
            </li>
          `).join('')}

        <li class="page-item ${page >= pages ? 'disabled' : ''}">
          <a class="page-link"
             href="/doctors?page=${page + 1}&${queryString}">
            Sau &raquo;
          </a>
        </li>

      </ul>
    </nav>
  ` : '';

  // Giao diện trang bác sĩ
  content = `
    <div class="row g-4">

      <div class="col-12 col-xl-4">
        <div class="card p-4">
          <h5 class="section-title mb-3">
            <i class="fa-solid fa-user-doctor text-primary me-2"></i>
            Thêm bác sĩ
          </h5>

          <form action="/doctors/add" method="POST">
            <div class="mb-3">
              <label class="form-label">Họ và tên</label>
              <input name="name"
                     class="form-control"
                     maxlength="150"
                     required>
            </div>

            <div class="mb-3">
              <label class="form-label">Chuyên khoa</label>
              <input name="specialty"
                     class="form-control"
                     maxlength="150"
                     placeholder="Nha khoa tổng quát"
                     required>
            </div>

            <div class="mb-3">
              <label class="form-label">Số điện thoại</label>
              <input name="phone"
                     class="form-control"
                     maxlength="20"
                     required>
            </div>

            <div class="mb-4">
              <label class="form-label">Email</label>
              <input name="email"
                     type="email"
                     class="form-control"
                     maxlength="150">
            </div>

            <button type="submit" class="btn btn-primary w-100">
              <i class="fa-solid fa-plus me-2"></i>
              Thêm bác sĩ
            </button>
          </form>
        </div>
      </div>

      <div class="col-12 col-xl-8">
        <div class="card p-3 p-lg-4">

          <div class="d-flex flex-wrap justify-content-between
                      align-items-center gap-3 mb-3">
            <div>
              <h5 class="section-title mb-1">Danh sách bác sĩ</h5>
              <div class="muted small">
                Hiển thị ${result.rows.length} / ${total} bác sĩ
                · Trang ${page}/${pages}
              </div>
            </div>

            <form method="GET"
                  action="/doctors"
                  class="d-flex gap-2">
              <input name="q"
                     value="${esc(search)}"
                     class="form-control"
                     placeholder="Tìm bác sĩ...">

              <button type="submit" class="btn btn-primary">
                <i class="fa-solid fa-magnifying-glass"></i>
              </button>
            </form>
          </div>

          <div class="table-responsive">
            <table class="table align-middle">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Họ tên</th>
                  <th>Chuyên khoa</th>
                  <th>Số điện thoại</th>
                  <th>Email</th>
                  <th>Hồ sơ phụ trách</th>
                  <th>Thao tác</th>
                </tr>
              </thead>

              <tbody>
                ${rows || `
                  <tr>
                    <td colspan="7">
                      <div class="empty-state">
                        <i class="fa-solid fa-user-doctor"></i>
                        ${
                          search
                            ? 'Không tìm thấy bác sĩ phù hợp.'
                            : 'Chưa có bác sĩ. Hãy thêm bác sĩ bằng biểu mẫu bên trái.'
                        }
                      </div>
                    </td>
                  </tr>
                `}
              </tbody>
            </table>
          </div>

          ${pagesHtml}

        </div>
      </div>

    </div>
  `;



    } else if (route === '/reports') {
      content = `
        <div class="row g-3 mb-4">
          ${statCard('Tổng hồ sơ bệnh nhân', patientCount, 'users', '#1769e0')}
          ${statCard('Lượt khám hôm nay', todayCount, 'calendar-day', '#15966a')}
          ${statCard('Tổng số bác sĩ', doctorCount, 'user-doctor', '#805ad5')}
        </div>

        `;
    } else {
      // DANH SÁCH BỆNH NHÂN VÀ LỊCH KHÁM
      const conditions = [];
      const params = [];

      if (search) {
        params.push(`%${search}%`);
        conditions.push(`
          (
            name ILIKE $${params.length}
            OR phone ILIKE $${params.length}
            OR COALESCE(symptom, '') ILIKE $${params.length}
            OR COALESCE(doctor, '') ILIKE $${params.length}
          )
        `);
      }

      if (route === '/appointments') {
        conditions.push('appointment_date IS NOT NULL');
      }

      const where = conditions.length
        ? `WHERE ${conditions.join(' AND ')}`
        : '';

      const count = await pool.query(
        `SELECT COUNT(*)::int AS total FROM patients ${where}`,
        params
      );

      const total = count.rows[0].total;
      const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
      const page = Math.min(
        Math.max(1, Number.parseInt(req.query.page, 10) || 1),
        pages
      );

      const listParams = [...params, PAGE_SIZE, (page - 1) * PAGE_SIZE];

      const patients = await pool.query(`
        SELECT id, name, age, gender, phone, symptom, doctor, appointment_date
        FROM patients
        ${where}
        ORDER BY id DESC
        LIMIT $${listParams.length - 1}
        OFFSET $${listParams.length}
      `, listParams);

      // Lấy danh sách bác sĩ từ bảng doctors.
      const doctors = (
        await pool.query('SELECT name FROM doctors ORDER BY name')
      ).rows;

      const patientRows = patients.rows.map((p, i) => `
        <tr>
          <td>${(page - 1) * PAGE_SIZE + i + 1}</td>
          <td>
            <b>${esc(p.name)}</b>
            <div class="muted small">${esc(p.phone)}</div>
          </td>
          <td>${p.age ?? '—'}</td>
          <td>${esc(p.gender || '—')}</td>
          <td>${esc(p.symptom || '—')}</td>
          <td>${esc(p.doctor || 'Chưa phân công')}</td>
          <td>
            ${p.appointment_date
              ? new Date(p.appointment_date).toLocaleDateString('vi-VN', {
                  timeZone: 'Asia/Ho_Chi_Minh'
                })
              : 'Chưa có lịch'}
          </td>
          <td>
            <form action="/delete/${p.id}" method="POST"
                  onsubmit="return confirm('Xóa hồ sơ này?')">
              <button class="btn btn-sm btn-outline-danger">
                <i class="fa-solid fa-trash"></i>
              </button>
            </form>
          </td>
        </tr>
      `).join('');

      const pagesHtml = pages > 1 ? `
        <nav class="mt-3">
          <ul class="pagination justify-content-center">
            ${Array.from({ length: pages }, (_, i) => `
              <li class="page-item ${page === i + 1 ? 'active' : ''}">
                <a class="page-link"
                   href="?page=${i + 1}&q=${encodeURIComponent(search)}">
                  ${i + 1}
                </a>
              </li>
            `).join('')}
          </ul>
        </nav>` : '';

      content = `
        ${route === '/' ? `
          <div class="row g-3 mb-4">
            ${statCard('Tổng hồ sơ bệnh nhân', patientCount, 'users', '#1769e0')}
            ${statCard('Lượt khám hôm nay', todayCount, 'calendar-day', '#15966a')}
            ${statCard('Tổng số bác sĩ', doctorCount, 'user-doctor', '#805ad5')}
          </div>
        ` : ''}

        <div class="row g-4">
          ${route !== '/appointments' ? `
            <div class="col-12 col-xl-4">
              <div class="card p-4">
                <h5 class="section-title mb-3">
                  <i class="fa-solid fa-user-plus text-primary me-2"></i>
                  Tiếp nhận bệnh nhân
                </h5>

                <form action="/add" method="POST">
                  <div class="mb-3">
                    <label class="form-label">Họ và tên</label>
                    <input name="name" class="form-control"
                           maxlength="150" required>
                  </div>

                  <div class="row mb-3">
                    <div class="col-5">
                      <label class="form-label">Tuổi</label>
                      <input name="age" type="number" min="0" max="130"
                             class="form-control" required>
                    </div>

                    <div class="col-7">
                      <label class="form-label">Giới tính</label>
                      <select name="gender" class="form-select" required>
                        <option value="Nam">Nam</option>
                        <option value="Nữ">Nữ</option>
                        <option value="Khác">Khác</option>
                      </select>
                    </div>
                  </div>

                  <div class="mb-3">
                    <label class="form-label">Điện thoại</label>
                    <input name="phone" class="form-control"
                           maxlength="20" required>
                  </div>

                  <div class="mb-3">
                    <label class="form-label">Lý do khám</label>
                    <textarea name="symptom" class="form-control"
                              maxlength="2000" rows="3"></textarea>
                  </div>

                  <div class="mb-3">
                    <label class="form-label">Bác sĩ phụ trách</label>
                    <select name="doctor" class="form-select">
                      <option value="">Chưa phân công</option>
                      ${doctors.map(d => `
                        <option value="${esc(d.name)}">${esc(d.name)}</option>
                      `).join('')}
                    </select>
                  </div>

                  <div class="mb-4">
                    <label class="form-label">Ngày khám</label>
                    <input name="appointment_date" type="date"
                           class="form-control" required>
                  </div>

                  <button class="btn btn-primary w-100" type="submit">
                    <i class="fa-solid fa-floppy-disk me-2"></i>
                    Lưu hồ sơ và lịch khám
                  </button>
                </form>
              </div>
            </div>
          ` : ''}

          <div class="${route === '/appointments' ? 'col-12' : 'col-12 col-xl-8'}">
            <div class="card p-3 p-lg-4">
              <div class="d-flex flex-wrap justify-content-between
                          align-items-center gap-3 mb-3">
                <div>
                  <h5 class="section-title">${esc(title)}</h5>
                  <div class="muted small">${total} hồ sơ</div>
                </div>

                <form method="GET" class="d-flex gap-2">
                  <input name="q" value="${esc(search)}"
                         class="form-control"
                         placeholder="Tìm tên, số điện thoại...">
                  <button class="btn btn-primary" type="submit">
                    <i class="fa-solid fa-magnifying-glass"></i>
                  </button>
                </form>
              </div>

              <div class="table-responsive">
                <table class="table align-middle">
                  <thead>
                    <tr>
                      <th>STT</th><th>Bệnh nhân</th><th>Tuổi</th>
                      <th>Giới tính</th><th>Lý do khám</th>
                      <th>Bác sĩ</th><th>Ngày khám</th><th>Xóa</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${patientRows || `
                      <tr>
                        <td colspan="8" class="text-center p-4">
                          Chưa có dữ liệu.
                        </td>
                      </tr>
                    `}
                  </tbody>
                </table>
              </div>

              ${pagesHtml}
            </div>
          </div>
        </div>`;
    }

    res.send(layout(title, route, content));
  } catch (err) {
    console.error('Lỗi render trang:', err);
    res.status(500).send(`
      <h2>Không thể tải trang</h2>
      <p>Kiểm tra kết nối PostgreSQL và cấu trúc bảng patients/doctors.</p>
      <a href="/">Quay lại</a>
    `);
  }
}

app.get(
  ['/', '/patients', '/appointments', '/doctors', '/reports'],
  renderPage
);

// THÊM HỒ SƠ BỆNH NHÂN
app.post('/add', async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const age = Number(req.body.age);
    const gender = String(req.body.gender || '').trim();
    const phone = String(req.body.phone || '').trim();
    const symptom = String(req.body.symptom || '').trim();
    const doctor = String(req.body.doctor || '').trim();
    const date = String(req.body.appointment_date || '').trim();

    if (!name || name.length > 150)
      return res.status(400).send('Họ tên không hợp lệ.');

    if (!Number.isInteger(age) || age < 0 || age > 130)
      return res.status(400).send('Tuổi không hợp lệ.');

    if (!['Nam', 'Nữ', 'Khác'].includes(gender))
      return res.status(400).send('Giới tính không hợp lệ.');

    if (!phone || phone.length > 20)
      return res.status(400).send('Số điện thoại không hợp lệ.');

    if (symptom.length > 2000)
      return res.status(400).send('Lý do khám quá dài.');

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
      return res.status(400).send('Ngày khám không hợp lệ.');

    const valid = new Date(`${date}T00:00:00Z`);

    if (Number.isNaN(valid.getTime()) ||
        valid.toISOString().slice(0, 10) !== date) {
      return res.status(400).send('Ngày khám không tồn tại.');
    }

    if (doctor) {
      const found = await pool.query(
        'SELECT id FROM doctors WHERE name = $1',
        [doctor]
      );

      if (!found.rowCount)
        return res.status(400).send('Bác sĩ không tồn tại.');
    }

    await pool.query(`
      INSERT INTO patients
        (name, age, gender, phone, symptom, doctor, appointment_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      name, age, gender, phone,
      symptom || null, doctor || null, date
    ]);

    res.redirect('/patients');
  } catch (err) {
    console.error('Lỗi thêm hồ sơ:', err);
    res.status(500).send('Không thể lưu hồ sơ bệnh nhân.');
  }
});

// XÓA HỒ SƠ BỆNH NHÂN
app.post('/delete/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id <= 0)
      return res.status(400).send('ID không hợp lệ.');

    const result = await pool.query(
      'DELETE FROM patients WHERE id = $1 RETURNING id',
      [id]
    );

    if (!result.rowCount)
      return res.status(404).send('Không tìm thấy hồ sơ.');

    res.redirect('/patients');
  } catch (err) {
    console.error('Lỗi xóa hồ sơ:', err);
    res.status(500).send('Không thể xóa hồ sơ.');
  }
});

// THÊM BÁC SĨ
app.post('/doctors/add', async (req, res) => {
  try {
    const validation = validateDoctor(req.body);

    if (validation.error)
      return res.status(400).send(esc(validation.error));

    const d = validation.data;

    await pool.query(`
      INSERT INTO doctors (name, specialty, phone, email)
      VALUES ($1, $2, $3, $4)
    `, [d.name, d.specialty, d.phone, d.email]);

    res.redirect('/doctors');
  } catch (err) {
    console.error('Lỗi thêm bác sĩ:', err);
    res.status(500).send(
      'Không thể thêm bác sĩ. Kiểm tra bảng doctors và dữ liệu trùng lặp.'
    );
  }
});

// SỬA THÔNG TIN BÁC SĨ
app.post('/doctors/update/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id <= 0)
      return res.status(400).send('ID bác sĩ không hợp lệ.');

    const validation = validateDoctor(req.body);

    if (validation.error)
      return res.status(400).send(esc(validation.error));

    const d = validation.data;

    const result = await pool.query(`
      UPDATE doctors
      SET name = $1,
          specialty = $2,
          phone = $3,
          email = $4
      WHERE id = $5
      RETURNING id
    `, [d.name, d.specialty, d.phone, d.email, id]);

    if (!result.rowCount)
      return res.status(404).send('Không tìm thấy bác sĩ.');

    res.redirect('/doctors');
  } catch (err) {
    console.error('Lỗi sửa bác sĩ:', err);
    res.status(500).send('Không thể cập nhật thông tin bác sĩ.');
  }
});

// XÓA BÁC SĨ
app.post('/doctors/delete/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id <= 0)
      return res.status(400).send('ID bác sĩ không hợp lệ.');

    const result = await pool.query(
      'SELECT name FROM doctors WHERE id = $1',
      [id]
    );

    if (!result.rowCount)
      return res.status(404).send('Không tìm thấy bác sĩ.');

    const assigned = await pool.query(`
      SELECT COUNT(*)::int AS total
      FROM patients
      WHERE TRIM(COALESCE(doctor, '')) = TRIM($1)
    `, [result.rows[0].name]);

    if (assigned.rows[0].total > 0) {
      return res.status(409).send(
        `Không thể xóa: bác sĩ đang được ghi nhận trong ${
          assigned.rows[0].total
        } hồ sơ bệnh nhân. Hãy phân công lại trước.`
      );
    }

    await pool.query(
      'DELETE FROM doctors WHERE id = $1',
      [id]
    );

    res.redirect('/doctors');
  } catch (err) {
    console.error('Lỗi xóa bác sĩ:', err);
    res.status(500).send('Không thể xóa bác sĩ.');
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
