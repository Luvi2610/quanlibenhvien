
const express = require('express');
const pool = require('./db');
const client = require('prom-client');

const app = express();
// Khởi tạo bộ đếm tổng số HTTP requests
const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status']
});

// Middleware tự động đếm mọi request đi qua ứng dụng
app.use((req, res, next) => {
  res.on('finish', () => {
    httpRequestsTotal.inc({ 
      method: req.method, 
      route: req.path, 
      status: res.statusCode 
    });
  });
  next();
});
const PORT = process.env.PORT || 3000;
const PAGE_SIZE = 5;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ================= PROMETHEUS =================

client.collectDefaultMetrics();

app.get('/metrics', async (req, res) => {
    try {
        res.set('Content-Type', client.register.contentType);
        res.end(await client.register.metrics());
    } catch (err) {
        console.error(err);
        res.status(500).send('Metrics error');
    }
});

// ================= HÀM HỖ TRỢ =================

function esc(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getId(value) {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function validDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const d = new Date(value + 'T00:00:00Z');
    return !Number.isNaN(d.getTime()) &&
        d.toISOString().slice(0, 10) === value;
}

function dateValue(value) {
    if (!value) return '';
    if (typeof value === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';

    return [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, '0'),
        String(d.getDate()).padStart(2, '0')
    ].join('-');
}

function formatDate(value) {
    const v = dateValue(value);
    if (!v) return '—';
    const [y, m, d] = v.split('-');
    return `${d}/${m}/${y}`;
}

function pageInfo(req, total) {
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const requested = Number.parseInt(req.query.page, 10) || 1;
    const page = Math.min(Math.max(1, requested), pages);

    return {
        page,
        pages,
        offset: (page - 1) * PAGE_SIZE
    };
}

function pagination(path, page, pages, search = '') {
    if (pages <= 1) return '';

    return `
        <nav class="mt-4">
            <ul class="pagination justify-content-center">
                ${Array.from({ length: pages }, (_, i) => `
                    <li class="page-item ${page === i + 1 ? 'active' : ''}">
                        <a class="page-link"
                           href="${path}?page=${i + 1}&q=${encodeURIComponent(search)}">
                            ${i + 1}
                        </a>
                    </li>
                `).join('')}
            </ul>
        </nav>
    `;
}

function searchForm(path, search, placeholder) {
    return `
        <form action="${path}" method="GET" class="d-flex gap-2">
            <input name="q"
                   value="${esc(search)}"
                   class="form-control"
                   placeholder="${esc(placeholder)}">

            <button class="btn btn-primary">
                <i class="fa-solid fa-search"></i>
            </button>
        </form>
    `;
}

// HIỂN THỊ BÁC SĨ KÈM CHUYÊN KHOA
function doctorOptions(doctors, selected = null) {
    return doctors.map(d => `
        <option value="${d.id}"
            ${Number(selected) === Number(d.id) ? 'selected' : ''}>
            ${esc(d.name)} — ${esc(d.specialty || 'Chưa có chuyên khoa')}
        </option>
    `).join('');
}

// ================= GIAO DIỆN CHUNG =================

function layout(title, active, content) {
    const links = [
        ['/', 'gauge-high', 'Tổng quan'],
        ['/patients', 'users', 'Quản lý bệnh nhân'],
        ['/appointments', 'calendar-days', 'Quản lý lịch khám'],
        ['/doctors', 'user-doctor', 'Quản lý bác sĩ']
    ];

    return `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${esc(title)} | Quản lý bệnh viện</title>

    <link
        href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"
        rel="stylesheet">

    <link
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css"
        rel="stylesheet">

    <style>
        :root {
            --primary: #1769e0;
            --navy: #14243a;
            --bg: #f4f7fb;
            --border: #e5eaf2;
            --muted: #718096;
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
            top: 0;
            bottom: 0;
            left: 0;
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

        .page-content {
            padding: 28px 30px;
        }

        .muted {
            color: var(--muted);
        }

        .card {
            border: 1px solid var(--border);
            border-radius: 14px;
            box-shadow: 0 4px 18px rgba(30,55,90,.035);
        }

        .form-control,
        .form-select {
            border-color: #dce3ed;
            border-radius: 8px;
            padding: 10px 12px;
        }

        .btn {
            border-radius: 8px;
        }

        .btn-primary {
            background: var(--primary);
        }

        .table {
            margin-bottom: 0;
        }

        .table thead th {
            background: #f7f9fc;
            color: #68778d;
            font-size: 11px;
            text-transform: uppercase;
            padding: 15px 12px;
            white-space: nowrap;
        }

        .table tbody td {
            padding: 14px 12px;
            vertical-align: middle;
            border-color: var(--border);
        }

        .table tbody tr:hover {
            background: #f8fbff;
        }

        .section-title {
            font-weight: 750;
        }

        .doctor-specialty {
            display: block;
            margin-top: 5px;
            font-size: 12px;
            color: var(--primary);
        }

        .pagination .active .page-link {
            background: var(--primary);
            border-color: var(--primary);
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

            .brand-text,
            .nav-link span,
            .nav-label {
                display: none;
            }

            .nav-link {
                justify-content: center;
            }

            .main {
                margin-left: 68px;
            }

            .topbar,
            .page-content {
                padding: 18px 14px;
            }
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

        <nav>
            ${links.map(([url, icon, name]) => `
                <a href="${url}"
                   class="nav-link ${active === url ? 'active' : ''}">
                    <i class="fa-solid fa-${icon}"></i>
                    <span>${name}</span>
                </a>
            `).join('')}
        </nav>
    </aside>

    <main class="main">
        <header class="topbar">
            <div>
                <div class="muted small">HỆ THỐNG / QUẢN TRỊ</div>
                <h5 class="mb-0 mt-1 fw-bold">${esc(title)}</h5>
            </div>

            <span class="badge text-bg-success p-2">
                <i class="fa-solid fa-circle-check me-1"></i>
                Đang hoạt động
            </span>
        </header>

        <div class="page-content">
            ${content}
        </div>

        <footer class="footer">
            Hệ thống quản lý bệnh viện · PostgreSQL
        </footer>
    </main>

    <script
        src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js">
    </script>
</body>
</html>`;
}

// ================= TỔNG QUAN =================

async function dashboardPage() {
    const [patients, appointments, doctors] = await Promise.all([
        pool.query('SELECT COUNT(*)::int AS total FROM patients'),
        pool.query('SELECT COUNT(*)::int AS total FROM appointments'),
        pool.query('SELECT COUNT(*)::int AS total FROM doctors')
    ]);

    const cards = [
        ['Bệnh nhân', patients.rows[0].total, 'users'],
        ['Lịch khám', appointments.rows[0].total, 'calendar-days'],
        ['Bác sĩ', doctors.rows[0].total, 'user-doctor']
    ];

    return `
        <div class="row g-3 mb-4">
            ${cards.map(([name, total, icon]) => `
                <div class="col-md-4">
                    <div class="card p-4">
                        <div class="muted">${name}</div>
                        <h2 class="fw-bold text-primary mt-2">
                            <i class="fa-solid fa-${icon} me-2"></i>
                            ${total}
                        </h2>
                    </div>
                </div>
            `).join('')}
        </div>

        <div class="card p-4">
            <h5 class="fw-bold">Hệ thống quản lý bệnh viện</h5>
            <p class="muted">
                Đặt lịch khám tự động lưu hồ sơ bệnh nhân
                và liên kết với bác sĩ phụ trách.
            </p>

            <a href="/appointments" class="btn btn-primary">
                <i class="fa-solid fa-calendar-plus me-2"></i>
                Đặt lịch khám
            </a>
        </div>
    `;
}

// ================= QUẢN LÝ BỆNH NHÂN =================
// KHÔNG CÒN FORM TIẾP NHẬN

async function patientsPage(req) {
    const search = String(req.query.q || '').trim().slice(0, 100);
    const params = [];

    let where = '';

    if (search) {
        params.push('%' + search + '%');

        where = `
            WHERE p.name ILIKE $1
               OR p.phone ILIKE $1
               OR COALESCE(p.symptom, '') ILIKE $1
        `;
    }

    const countResult = await pool.query(`
        SELECT COUNT(*)::int AS total
        FROM patients p
        ${where}
    `, params);

    const total = countResult.rows[0].total;
    const { page, pages, offset } = pageInfo(req, total);

    const listParams = [...params, PAGE_SIZE, offset];

    const result = await pool.query(`
        SELECT
            p.id,
            p.name,
            p.age,
            p.gender,
            p.phone,
            p.symptom,
            COUNT(a.id)::int AS appointment_count,
            MAX(a.appointment_date) AS latest_date

        FROM patients p

        LEFT JOIN appointments a
            ON a.patient_id = p.id

        ${where}

        GROUP BY
            p.id, p.name, p.age,
            p.gender, p.phone, p.symptom

        ORDER BY p.id DESC

        LIMIT $${listParams.length - 1}
        OFFSET $${listParams.length}
    `, listParams);

    const rows = result.rows.map((p, i) => `
        <tr>
            <td>${offset + i + 1}</td>

            <td>
                <strong>${esc(p.name)}</strong>
                <div class="muted small">${esc(p.phone)}</div>
            </td>

            <td>${esc(p.age)}</td>
            <td>${esc(p.gender)}</td>
            <td>${esc(p.symptom || '—')}</td>

            <td>
                <span class="badge text-bg-primary">
                    ${p.appointment_count} lịch
                </span>
            </td>

            <td>${formatDate(p.latest_date)}</td>

            <td>
                <div class="d-flex gap-2">
                    <a href="/appointments?patient_id=${p.id}"
                       class="btn btn-sm btn-outline-primary"
                       title="Xem lịch khám">
                        <i class="fa-solid fa-calendar-days"></i>
                    </a>

                    <form action="/patients/delete/${p.id}"
                          method="POST"
                          onsubmit="return confirm('Xóa bệnh nhân này?')">

                        <button class="btn btn-sm btn-outline-danger">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </form>
                </div>
            </td>
        </tr>
    `).join('');

    return `
        <div class="card p-3 p-lg-4">

            <div class="d-flex flex-wrap justify-content-between
                        align-items-center gap-3 mb-3">

                <div>
                    <h5 class="section-title mb-1">
                        <i class="fa-solid fa-users text-primary me-2"></i>
                        Danh sách bệnh nhân
                    </h5>

                    <div class="muted small">
                        Tổng cộng ${total} bệnh nhân
                    </div>
                </div>

                <div class="d-flex flex-wrap gap-2">
                    ${searchForm('/patients', search, 'Tìm bệnh nhân...')}

                    <a href="/appointments" class="btn btn-primary">
                        <i class="fa-solid fa-calendar-plus me-1"></i>
                        Đặt lịch khám
                    </a>
                </div>
            </div>

            <div class="table-responsive">
                <table class="table align-middle">
                    <thead>
                        <tr>
                            <th>STT</th>
                            <th>Bệnh nhân</th>
                            <th>Tuổi</th>
                            <th>Giới tính</th>
                            <th>Lý do khám</th>
                            <th>Số lịch khám</th>
                            <th>Lịch gần nhất</th>
                            <th>Thao tác</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${rows || `
                            <tr>
                                <td colspan="8" class="text-center p-4">
                                    Chưa có bệnh nhân
                                </td>
                            </tr>
                        `}
                    </tbody>
                </table>
            </div>

            ${pagination('/patients', page, pages, search)}
        </div>
    `;
}

// ================= QUẢN LÝ LỊCH KHÁM =================

async function appointmentsPage(req) {
    const search = String(req.query.q || '').trim().slice(0, 100);
    const patientFilter = req.query.patient_id
        ? getId(req.query.patient_id)
        : null;

    const params = [];
    const conditions = [];

    if (search) {
        params.push('%' + search + '%');

        conditions.push(`(
            p.name ILIKE $${params.length}
            OR p.phone ILIKE $${params.length}
            OR d.name ILIKE $${params.length}
            OR COALESCE(d.specialty, '') ILIKE $${params.length}
        )`);
    }

    if (patientFilter) {
        params.push(patientFilter);
        conditions.push(`a.patient_id = $${params.length}`);
    }

    const where = conditions.length
        ? 'WHERE ' + conditions.join(' AND ')
        : '';

    const countResult = await pool.query(`
        SELECT COUNT(*)::int AS total

        FROM appointments a

        JOIN patients p ON p.id = a.patient_id
        JOIN doctors d ON d.id = a.doctor_id

        ${where}
    `, params);

    const total = countResult.rows[0].total;
    const { page, pages, offset } = pageInfo(req, total);

    const listParams = [...params, PAGE_SIZE, offset];

    // LẤY CẢ CHUYÊN KHOA BÁC SĨ
    const result = await pool.query(`
        SELECT
            a.id,
            a.patient_id,
            a.doctor_id,
            a.appointment_date,
            a.status,

            p.name AS patient_name,
            p.phone AS patient_phone,
            p.age,
            p.gender,
            p.symptom,

            d.name AS doctor_name,
            d.specialty AS doctor_specialty

        FROM appointments a

        JOIN patients p ON p.id = a.patient_id
        JOIN doctors d ON d.id = a.doctor_id

        ${where}

        ORDER BY a.appointment_date DESC, a.id DESC

        LIMIT $${listParams.length - 1}
        OFFSET $${listParams.length}
    `, listParams);

    const patients = (await pool.query(`
        SELECT id, name, phone
        FROM patients
        ORDER BY name, id
    `)).rows;

    // QUAN TRỌNG: SELECT THÊM SPECIALTY
    const doctors = (await pool.query(`
        SELECT id, name, specialty
        FROM doctors
        ORDER BY specialty ASC, name ASC, id ASC
    `)).rows;

    const statuses = [
        'Chờ khám',
        'Đã xác nhận',
        'Đã khám',
        'Đã hủy'
    ];

    const rows = result.rows.map((a, i) => `
        <tr>
            <td>${offset + i + 1}</td>

            <td>
                <strong>${esc(a.patient_name)}</strong>
                <div class="muted small">
                    ${esc(a.patient_phone)}
                </div>
            </td>

            <td>${esc(a.age)}</td>
            <td>${esc(a.gender)}</td>
            <td>${esc(a.symptom || '—')}</td>

            <td>
                <strong>${esc(a.doctor_name)}</strong>

                <span class="doctor-specialty">
                    <i class="fa-solid fa-stethoscope me-1"></i>
                    ${esc(a.doctor_specialty || 'Chưa có chuyên khoa')}
                </span>
            </td>

            <td>${formatDate(a.appointment_date)}</td>

            <td>
                <span class="badge text-bg-info">
                    ${esc(a.status || 'Chờ khám')}
                </span>
            </td>

            <td>
                <div class="d-flex gap-2">

                    <button type="button"
                            class="btn btn-sm btn-outline-primary"
                            data-bs-toggle="modal"
                            data-bs-target="#edit${a.id}">
                        <i class="fa-solid fa-pen"></i>
                    </button>

                    <form action="/appointments/delete/${a.id}"
                          method="POST"
                          onsubmit="return confirm('Xóa lịch khám này?')">

                        <button class="btn btn-sm btn-outline-danger">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </form>
                </div>

                <div class="modal fade"
                     id="edit${a.id}"
                     tabindex="-1">

                    <div class="modal-dialog modal-dialog-centered">
                        <div class="modal-content">

                            <form action="/appointments/update/${a.id}"
                                  method="POST">

                                <div class="modal-header">
                                    <h5 class="modal-title">
                                        Sửa lịch khám #${a.id}
                                    </h5>

                                    <button type="button"
                                            class="btn-close"
                                            data-bs-dismiss="modal">
                                    </button>
                                </div>

                                <div class="modal-body">

                                    <div class="mb-3">
                                        <label class="form-label">
                                            Bệnh nhân
                                        </label>

                                        <input class="form-control"
                                               value="${esc(a.patient_name)}"
                                               readonly>
                                    </div>

                                    <div class="mb-3">
                                        <label class="form-label">
                                            Bác sĩ phụ trách — Chuyên khoa
                                        </label>

                                        <select name="doctor_id"
                                                class="form-select"
                                                required>

                                            ${doctorOptions(doctors, a.doctor_id)}

                                        </select>
                                    </div>

                                    <div class="mb-3">
                                        <label class="form-label">
                                            Ngày khám
                                        </label>

                                        <input type="date"
                                               name="appointment_date"
                                               value="${dateValue(a.appointment_date)}"
                                               class="form-control"
                                               required>
                                    </div>

                                    <div class="mb-3">
                                        <label class="form-label">
                                            Trạng thái
                                        </label>

                                        <select name="status"
                                                class="form-select">

                                            ${[...new Set([
                                                ...statuses,
                                                a.status
                                            ].filter(Boolean))].map(s => `
                                                <option value="${esc(s)}"
                                                    ${s === a.status ? 'selected' : ''}>
                                                    ${esc(s)}
                                                </option>
                                            `).join('')}

                                        </select>
                                    </div>
                                </div>

                                <div class="modal-footer">
                                    <button type="button"
                                            class="btn btn-light"
                                            data-bs-dismiss="modal">
                                        Hủy
                                    </button>

                                    <button class="btn btn-primary">
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

    // MODAL ĐƯỢC TẠO TRONG TỪNG DÒNG BẢNG.
    // FORM ĐẶT LỊCH NẰM Ở ĐẦU TRANG.
    return `
        <div class="card p-4 mb-4">

            <h5 class="section-title mb-3">
                <i class="fa-solid fa-calendar-plus text-primary me-2"></i>
                Đặt lịch khám
            </h5>

            <form action="/appointments/add"
                  method="POST"
                  id="bookingForm">

                <div class="mb-3">
                    <label class="form-label fw-semibold">
                        Loại bệnh nhân
                    </label>

                    <div class="d-flex flex-wrap gap-4">
                        <label>
                            <input type="radio"
                                   name="patient_type"
                                   value="new"
                                   ${patientFilter ? '' : 'checked'}>
                            Bệnh nhân mới
                        </label>

                        <label>
                            <input type="radio"
                                   name="patient_type"
                                   value="existing"
                                   ${patientFilter ? 'checked' : ''}>
                            Bệnh nhân đã có
                        </label>
                    </div>
                </div>

                <div id="newPatientFields">

                    <div class="row g-3">

                        <div class="col-md-6">
                            <label class="form-label">Họ tên bệnh nhân</label>

                            <input name="name"
                                   class="form-control"
                                   maxlength="150"
                                   placeholder="Nhập họ tên"
                                   required>
                        </div>

                        <div class="col-md-3">
                            <label class="form-label">Tuổi</label>

                            <input name="age"
                                   type="number"
                                   min="0"
                                   max="130"
                                   class="form-control"
                                   required>
                        </div>

                        <div class="col-md-3">
                            <label class="form-label">Giới tính</label>

                            <select name="gender" class="form-select">
                                <option value="Nam">Nam</option>
                                <option value="Nữ">Nữ</option>
                                <option value="Khác">Khác</option>
                            </select>
                        </div>

                        <div class="col-md-6">
                            <label class="form-label">Số điện thoại</label>

                            <input name="phone"
                                   class="form-control"
                                   maxlength="20"
                                   placeholder="Nhập số điện thoại"
                                   required>
                        </div>

                        <div class="col-md-6">
                            <label class="form-label">Lý do khám</label>

                            <input name="symptom"
                                   class="form-control"
                                   maxlength="2000"
                                   placeholder="Ví dụ: Đau đầu, chóng mặt">
                        </div>
                    </div>
                </div>

                <div id="existingPatientFields" class="d-none">

                    <div class="mb-3">
                        <label class="form-label">
                            Chọn bệnh nhân đã có
                        </label>

                        <select name="patient_id"
                                class="form-select"
                                disabled
                                required>

                            <option value="">-- Chọn bệnh nhân --</option>

                            ${patients.map(p => `
                                <option value="${p.id}"
                                    ${p.id === patientFilter ? 'selected' : ''}>
                                    ${esc(p.name)} — ${esc(p.phone)}
                                </option>
                            `).join('')}

                        </select>
                    </div>
                </div>

                <div class="row g-3 mt-1">

                    <div class="col-md-6">

                        <label class="form-label fw-semibold">
                            <i class="fa-solid fa-user-doctor text-primary me-1"></i>
                            Bác sĩ phụ trách — Chuyên khoa
                        </label>

                        <select name="doctor_id"
                                class="form-select"
                                required>

                            <option value="">
                                -- Chọn bác sĩ phù hợp --
                            </option>

                            ${doctorOptions(doctors)}

                        </select>

                        <div class="form-text">
                            Danh sách hiển thị họ tên và chuyên khoa
                            để lựa chọn bác sĩ phù hợp với bệnh nhân.
                        </div>
                    </div>

                    <div class="col-md-6">
                        <label class="form-label fw-semibold">
                            Ngày khám
                        </label>

                        <input name="appointment_date"
                               type="date"
                               class="form-control"
                               required>
                    </div>
                </div>

                <div class="mt-4">
                    <button class="btn btn-primary px-4">
                        <i class="fa-solid fa-calendar-check me-2"></i>
                        Xác nhận đặt lịch
                    </button>
                </div>
            </form>
        </div>

        <div class="card p-3 p-lg-4">

            <div class="d-flex flex-wrap justify-content-between
                        align-items-center gap-3 mb-3">

                <div>
                    <h5 class="section-title mb-1">
                        Danh sách lịch khám
                    </h5>

                    <div class="muted small">
                        Tổng cộng ${total} lịch khám
                    </div>
                </div>

                ${searchForm('/appointments', search, 'Tìm bệnh nhân, bác sĩ, chuyên khoa...')}
            </div>

            ${patientFilter ? `
                <div class="alert alert-info">
                    Đang xem lịch khám của bệnh nhân #${patientFilter}.
                    <a href="/appointments">Xem tất cả</a>
                </div>
            ` : ''}

            <div class="table-responsive">

                <table class="table align-middle">

                    <thead>
                        <tr>
                            <th>STT</th>
                            <th>Bệnh nhân</th>
                            <th>Tuổi</th>
                            <th>Giới tính</th>
                            <th>Lý do khám</th>
                            <th>Bác sĩ / Chuyên khoa</th>
                            <th>Ngày khám</th>
                            <th>Trạng thái</th>
                            <th>Thao tác</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${rows || `
                            <tr>
                                <td colspan="9" class="text-center p-4">
                                    Chưa có lịch khám
                                </td>
                            </tr>
                        `}
                    </tbody>
                </table>
            </div>

            ${pagination('/appointments', page, pages, search)}
        </div>

        <script>
            (function () {
                const form = document.getElementById('bookingForm');
                const newFields = document.getElementById('newPatientFields');
                const oldFields = document.getElementById('existingPatientFields');

                function updateMode() {
                    const selected = form.querySelector(
                        'input[name="patient_type"]:checked'
                    );

                    const isNew = selected.value === 'new';

                    newFields.classList.toggle('d-none', !isNew);
                    oldFields.classList.toggle('d-none', isNew);

                    newFields.querySelectorAll('input,select,textarea')
                        .forEach(el => el.disabled = !isNew);

                    oldFields.querySelectorAll('input,select,textarea')
                        .forEach(el => el.disabled = isNew);
                }

                form.querySelectorAll('input[name="patient_type"]')
                    .forEach(el => {
                        el.addEventListener('change', updateMode);
                    });

                updateMode();
            })();
        </script>
    `;
}

// ================= QUẢN LÝ BÁC SĨ =================

async function doctorsPage(req) {
    const search = String(req.query.q || '').trim().slice(0, 100);
    const params = [];

    let where = '';

    if (search) {
        params.push('%' + search + '%');

        where = `
            WHERE d.name ILIKE $1
               OR d.specialty ILIKE $1
               OR d.phone ILIKE $1
               OR COALESCE(d.email, '') ILIKE $1
        `;
    }

    const countResult = await pool.query(`
        SELECT COUNT(*)::int AS total
        FROM doctors d
        ${where}
    `, params);

    const total = countResult.rows[0].total;
    const { page, pages, offset } = pageInfo(req, total);

    const listParams = [...params, PAGE_SIZE, offset];

    const result = await pool.query(`
        SELECT
            d.id,
            d.name,
            d.specialty,
            d.phone,
            d.email,
            COUNT(DISTINCT a.patient_id)::int AS patient_count

        FROM doctors d

        LEFT JOIN appointments a
            ON a.doctor_id = d.id

        ${where}

        GROUP BY
            d.id, d.name, d.specialty,
            d.phone, d.email

        ORDER BY d.id ASC

        LIMIT $${listParams.length - 1}
        OFFSET $${listParams.length}
    `, listParams);

    const rows = result.rows.map(d => `
        <tr>
            <td>${d.id}</td>
            <td><strong>${esc(d.name)}</strong></td>

            <td>
                <span class="badge text-bg-light border">
                    ${esc(d.specialty || 'Chưa có chuyên khoa')}
                </span>
            </td>

            <td>${esc(d.phone)}</td>
            <td>${esc(d.email || '—')}</td>
            <td>${d.patient_count}</td>

            <td>
                <div class="d-flex gap-2">

                    <button class="btn btn-sm btn-outline-primary"
                            data-bs-toggle="modal"
                            data-bs-target="#doctor${d.id}">
                        <i class="fa-solid fa-pen"></i>
                    </button>

                    <form action="/doctors/delete/${d.id}"
                          method="POST"
                          onsubmit="return confirm('Xóa bác sĩ này?')">

                        <button class="btn btn-sm btn-outline-danger">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </form>
                </div>

                <div class="modal fade"
                     id="doctor${d.id}"
                     tabindex="-1">

                    <div class="modal-dialog modal-dialog-centered">
                        <div class="modal-content">

                            <form action="/doctors/update/${d.id}"
                                  method="POST">

                                <div class="modal-header">
                                    <h5 class="modal-title">
                                        Chỉnh sửa bác sĩ
                                    </h5>

                                    <button type="button"
                                            class="btn-close"
                                            data-bs-dismiss="modal">
                                    </button>
                                </div>

                                <div class="modal-body">

                                    <label class="form-label">Họ tên</label>

                                    <input name="name"
                                           value="${esc(d.name)}"
                                           class="form-control mb-3"
                                           required>

                                    <label class="form-label">
                                        Chuyên khoa
                                    </label>

                                    <input name="specialty"
                                           value="${esc(d.specialty)}"
                                           class="form-control mb-3"
                                           required>

                                    <label class="form-label">
                                        Số điện thoại
                                    </label>

                                    <input name="phone"
                                           value="${esc(d.phone)}"
                                           class="form-control mb-3"
                                           required>

                                    <label class="form-label">Email</label>

                                    <input name="email"
                                           type="email"
                                           value="${esc(d.email || '')}"
                                           class="form-control">
                                </div>

                                <div class="modal-footer">
                                    <button type="button"
                                            class="btn btn-light"
                                            data-bs-dismiss="modal">
                                        Hủy
                                    </button>

                                    <button class="btn btn-primary">
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

    return `
        <div class="card p-4 mb-4">

            <h5 class="section-title mb-3">
                <i class="fa-solid fa-user-doctor text-primary me-2"></i>
                Thêm bác sĩ
            </h5>

            <form action="/doctors/add" method="POST">

                <div class="row g-3">

                    <div class="col-md-3">
                        <input name="name"
                               class="form-control"
                               placeholder="Họ tên bác sĩ"
                               maxlength="150"
                               required>
                    </div>

                    <div class="col-md-3">
                        <input name="specialty"
                               class="form-control"
                               placeholder="Chuyên khoa"
                               maxlength="150"
                               required>
                    </div>

                    <div class="col-md-3">
                        <input name="phone"
                               class="form-control"
                               placeholder="Số điện thoại"
                               maxlength="20"
                               required>
                    </div>

                    <div class="col-md-3">
                        <input name="email"
                               type="email"
                               class="form-control"
                               placeholder="Email"
                               maxlength="150">
                    </div>
                </div>

                <button class="btn btn-primary mt-3">
                    <i class="fa-solid fa-plus me-1"></i>
                    Thêm bác sĩ
                </button>
            </form>
        </div>

        <div class="card p-4">

            <div class="d-flex flex-wrap justify-content-between
                        gap-3 mb-3">

                <div>
                    <h5 class="section-title mb-1">
                        Danh sách bác sĩ
                    </h5>

                    <div class="muted small">
                        Tổng cộng ${total} bác sĩ
                    </div>
                </div>

                ${searchForm('/doctors', search, 'Tìm bác sĩ, chuyên khoa...')}
            </div>

            <div class="table-responsive">

                <table class="table">

                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Họ tên</th>
                            <th>Chuyên khoa</th>
                            <th>Điện thoại</th>
                            <th>Email</th>
                            <th>Số bệnh nhân</th>
                            <th>Thao tác</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${rows || `
                            <tr>
                                <td colspan="7" class="text-center p-4">
                                    Chưa có bác sĩ
                                </td>
                            </tr>
                        `}
                    </tbody>
                </table>
            </div>

            ${pagination('/doctors', page, pages, search)}
        </div>
    `;
}

// ================= ROUTES HIỂN THỊ =================

async function renderPage(req, res) {
    try {
        const titles = {
            '/': 'Tổng quan',
            '/patients': 'Quản lý bệnh nhân',
            '/appointments': 'Quản lý lịch khám',
            '/doctors': 'Quản lý bác sĩ'
        };

        let content;

        switch (req.path) {
            case '/patients':
                content = await patientsPage(req);
                break;

            case '/appointments':
                content = await appointmentsPage(req);
                break;

            case '/doctors':
                content = await doctorsPage(req);
                break;

            default:
                content = await dashboardPage();
        }

        res.send(layout(
            titles[req.path],
            req.path,
            content
        ));

    } catch (err) {
        console.error('Lỗi tải trang:', err);

        res.status(500).send(
            'Không thể tải trang. Kiểm tra Docker logs.'
        );
    }
}

app.get([
    '/',
    '/patients',
    '/appointments',
    '/doctors'
], renderPage);

// ================= ĐẶT LỊCH KHÁM =================

app.post('/appointments/add', async (req, res) => {
    const type = String(req.body.patient_type || '');
    const doctorId = getId(req.body.doctor_id);
    const date = String(req.body.appointment_date || '').trim();

    if (!['new', 'existing'].includes(type) ||
        !doctorId ||
        !validDate(date)) {

        return res.status(400).send(
            'Thông tin đặt lịch không hợp lệ.'
        );
    }

    let db;

    try {
        db = await pool.connect();
        await db.query('BEGIN');

        const doctor = await db.query(`
            SELECT id, name, specialty
            FROM doctors
            WHERE id = $1
        `, [doctorId]);

        if (!doctor.rowCount) {
            await db.query('ROLLBACK');

            return res.status(400).send(
                'Bác sĩ không tồn tại.'
            );
        }

        let patientId;

        if (type === 'new') {
            const name = String(req.body.name || '').trim();
            const age = Number(req.body.age);
            const gender = String(req.body.gender || '').trim();
            const phone = String(req.body.phone || '').trim();
            const symptom = String(req.body.symptom || '').trim();

            if (
                !name ||
                name.length > 150 ||
                req.body.age === undefined ||
                String(req.body.age).trim() === '' ||
                !Number.isInteger(age) ||
                age < 0 ||
                age > 130 ||
                !['Nam', 'Nữ', 'Khác'].includes(gender) ||
                !phone ||
                phone.length > 20 ||
                symptom.length > 2000
            ) {
                await db.query('ROLLBACK');

                return res.status(400).send(
                    'Thông tin bệnh nhân không hợp lệ.'
                );
            }

            // KIỂM TRA HỒ SƠ CÓ THỂ ĐÃ TỒN TẠI
            const existing = await db.query(`
                SELECT id
                FROM patients
                WHERE phone = $1
                  AND LOWER(TRIM(name)) = LOWER(TRIM($2))
                ORDER BY id ASC
            `, [phone, name]);

            if (existing.rowCount > 0) {
                await db.query('ROLLBACK');

                return res.status(409).send(
                    'Bệnh nhân có cùng tên và số điện thoại ' +
                    'đã tồn tại. Hãy chọn "Bệnh nhân đã có" ' +
                    'và chọn đúng hồ sơ để đặt thêm lịch.'
                );
            }

            // THÊM BỆNH NHÂN MỚI
            const inserted = await db.query(`
                INSERT INTO patients
                    (
                        name,
                        age,
                        gender,
                        phone,
                        symptom,
                        doctor,
                        appointment_date
                    )

                VALUES ($1, $2, $3, $4, $5, $6, $7)

                RETURNING id
            `, [
                name,
                age,
                gender,
                phone,
                symptom || null,
                doctor.rows[0].name,
                date
            ]);

            patientId = inserted.rows[0].id;

        } else {
            // BỆNH NHÂN CŨ: KHÔNG TẠO THÊM HỒ SƠ
            patientId = getId(req.body.patient_id);

            if (!patientId) {
                await db.query('ROLLBACK');

                return res.status(400).send(
                    'Vui lòng chọn bệnh nhân.'
                );
            }

            const patient = await db.query(`
                SELECT id
                FROM patients
                WHERE id = $1
            `, [patientId]);

            if (!patient.rowCount) {
                await db.query('ROLLBACK');

                return res.status(404).send(
                    'Không tìm thấy bệnh nhân.'
                );
            }
        }

        // TẠO LỊCH KHÁM
        await db.query(`
            INSERT INTO appointments
                (
                    patient_id,
                    doctor_id,
                    appointment_date,
                    status
                )

            VALUES ($1, $2, $3, $4)
        `, [
            patientId,
            doctorId,
            date,
            'Chờ khám'
        ]);

        await db.query('COMMIT');

        res.redirect('/appointments');

    } catch (err) {
        if (db) {
            try {
                await db.query('ROLLBACK');
            } catch (rollbackError) {
                console.error('Rollback error:', rollbackError);
            }
        }

        console.error('Lỗi đặt lịch:', err);

        res.status(500).send(
            'Không thể đặt lịch khám. Kiểm tra Docker logs.'
        );

    } finally {
        if (db) db.release();
    }
});

// ================= SỬA LỊCH KHÁM =================

app.post('/appointments/update/:id', async (req, res) => {
    const id = getId(req.params.id);
    const doctorId = getId(req.body.doctor_id);
    const date = String(req.body.appointment_date || '').trim();
    const status = String(req.body.status || '').trim();

    const allowedStatuses = [
        'Chờ khám',
        'Đã xác nhận',
        'Đã khám',
        'Đã hủy'
    ];

    if (
        !id ||
        !doctorId ||
        !validDate(date) ||
        !allowedStatuses.includes(status)
    ) {
        return res.status(400).send(
            'Thông tin lịch khám không hợp lệ.'
        );
    }

    try {
        const doctor = await pool.query(`
            SELECT id
            FROM doctors
            WHERE id = $1
        `, [doctorId]);

        if (!doctor.rowCount) {
            return res.status(400).send(
                'Bác sĩ không tồn tại.'
            );
        }

        const result = await pool.query(`
            UPDATE appointments

            SET doctor_id = $1,
                appointment_date = $2,
                status = $3

            WHERE id = $4

            RETURNING id
        `, [
            doctorId,
            date,
            status,
            id
        ]);

        if (!result.rowCount) {
            return res.status(404).send(
                'Không tìm thấy lịch khám.'
            );
        }

        res.redirect('/appointments');

    } catch (err) {
        console.error('Lỗi sửa lịch:', err);

        res.status(500).send(
            'Không thể sửa lịch khám.'
        );
    }
});

// ================= XÓA LỊCH KHÁM =================

app.post('/appointments/delete/:id', async (req, res) => {
    const id = getId(req.params.id);

    if (!id) {
        return res.status(400).send('ID không hợp lệ.');
    }

    try {
        await pool.query(`
            DELETE FROM appointments
            WHERE id = $1
        `, [id]);

        // CHỈ XÓA LỊCH, KHÔNG XÓA BỆNH NHÂN
        res.redirect('/appointments');

    } catch (err) {
        console.error('Lỗi xóa lịch:', err);

        res.status(500).send(
            'Không thể xóa lịch khám.'
        );
    }
});

// ================= XÓA BỆNH NHÂN =================

app.post('/patients/delete/:id', async (req, res) => {
    const id = getId(req.params.id);

    if (!id) {
        return res.status(400).send('ID không hợp lệ.');
    }

    try {
        const count = await pool.query(`
            SELECT COUNT(*)::int AS total
            FROM appointments
            WHERE patient_id = $1
        `, [id]);

        if (count.rows[0].total > 0) {
            return res.status(409).send(
                'Bệnh nhân vẫn còn lịch khám. ' +
                'Không thể xóa hồ sơ.'
            );
        }

        await pool.query(`
            DELETE FROM patients
            WHERE id = $1
        `, [id]);

        res.redirect('/patients');

    } catch (err) {
        console.error('Lỗi xóa bệnh nhân:', err);

        res.status(500).send(
            'Không thể xóa bệnh nhân.'
        );
    }
});

// ================= THÊM BÁC SĨ =================

function validateDoctor(body) {
    const name = String(body.name || '').trim();
    const specialty = String(body.specialty || '').trim();
    const phone = String(body.phone || '').trim();
    const email = String(body.email || '').trim();

    if (
        !name ||
        name.length > 150 ||
        !specialty ||
        specialty.length > 150 ||
        !phone ||
        phone.length > 20 ||
        email.length > 150 ||
        (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    ) {
        return null;
    }

    return {
        name,
        specialty,
        phone,
        email: email || null
    };
}

app.post('/doctors/add', async (req, res) => {
    const d = validateDoctor(req.body);

    if (!d) {
        return res.status(400).send(
            'Thông tin bác sĩ không hợp lệ.'
        );
    }

    try {
        await pool.query(`
            INSERT INTO doctors
                (name, specialty, phone, email)

            VALUES ($1, $2, $3, $4)
        `, [
            d.name,
            d.specialty,
            d.phone,
            d.email
        ]);

        res.redirect('/doctors');

    } catch (err) {
        console.error('Lỗi thêm bác sĩ:', err);

        res.status(500).send(
            'Không thể thêm bác sĩ.'
        );
    }
});

// ================= SỬA BÁC SĨ =================

app.post('/doctors/update/:id', async (req, res) => {
    const id = getId(req.params.id);
    const d = validateDoctor(req.body);

    if (!id || !d) {
        return res.status(400).send(
            'Thông tin bác sĩ không hợp lệ.'
        );
    }

    try {
        const result = await pool.query(`
            UPDATE doctors

            SET name = $1,
                specialty = $2,
                phone = $3,
                email = $4

            WHERE id = $5

            RETURNING id
        `, [
            d.name,
            d.specialty,
            d.phone,
            d.email,
            id
        ]);

        if (!result.rowCount) {
            return res.status(404).send(
                'Không tìm thấy bác sĩ.'
            );
        }

        res.redirect('/doctors');

    } catch (err) {
        console.error('Lỗi sửa bác sĩ:', err);

        res.status(500).send(
            'Không thể sửa bác sĩ.'
        );
    }
});

// ================= XÓA BÁC SĨ =================

app.post('/doctors/delete/:id', async (req, res) => {
    const id = getId(req.params.id);

    if (!id) {
        return res.status(400).send('ID không hợp lệ.');
    }

    try {
        const doctor = await pool.query(`
            SELECT name
            FROM doctors
            WHERE id = $1
        `, [id]);

        if (!doctor.rowCount) {
            return res.status(404).send(
                'Không tìm thấy bác sĩ.'
            );
        }

        const appointments = await pool.query(`
            SELECT COUNT(*)::int AS total
            FROM appointments
            WHERE doctor_id = $1
        `, [id]);

        const legacyPatients = await pool.query(`
            SELECT COUNT(*)::int AS total
            FROM patients
            WHERE TRIM(COALESCE(doctor, '')) = TRIM($1)
        `, [doctor.rows[0].name]);

        if (
            appointments.rows[0].total > 0 ||
            legacyPatients.rows[0].total > 0
        ) {
            return res.status(409).send(
                'Bác sĩ đang có lịch khám hoặc hồ sơ bệnh nhân phụ trách. ' +
                'Không thể xóa.'
            );
        }

        await pool.query(`
            DELETE FROM doctors
            WHERE id = $1
        `, [id]);

        res.redirect('/doctors');

    } catch (err) {
        console.error('Lỗi xóa bác sĩ:', err);

        res.status(500).send(
            'Không thể xóa bác sĩ.'
        );
    }
});

// ================= KHỞI ĐỘNG SERVER =================

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Metrics: http://localhost:${PORT}/metrics`);
});
