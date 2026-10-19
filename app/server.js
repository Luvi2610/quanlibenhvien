const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('<h1>Hệ thống Quản lý Phòng khám / Bệnh viện - Đề 8</h1><p>Trạng thái: Hoạt động bình thường</p>');
});

app.listen(PORT, () => {
    console.log(`Server đang chạy tại cổng ${PORT}`);
});