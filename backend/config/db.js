const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/restaurant_pos';
        await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 5000, // Giảm từ 30s xuống 5s chống treo request
            socketTimeoutMS: 15000,
            maxPoolSize: 15, // Giới hạn connection pool, tối ưu RAM cho MongoDB
            minPoolSize: 2,
            family: 4 // Ưu tiên kết nối IPv4 (127.0.0.1) nhanh và ổn định
        });
        console.log('✅ MongoDB Connected Successfully');
    } catch (err) {
        console.error('❌ MongoDB Connection Error:', err.message);
        // Không kill process lập tức mà cho phép Mongoose tự động retry kết nối ngầm
    }
};

mongoose.connection.on('disconnected', () => {
    console.warn('⚠️ [MongoDB]: Mất kết nối database. Đang tự động kết nối lại ngầm...');
});

mongoose.connection.on('reconnected', () => {
    console.log('🔄 [MongoDB]: Đã khôi phục kết nối database thành công!');
});

mongoose.connection.on('error', (err) => {
    console.error('⚠️ [MongoDB Error]:', err.message);
});

module.exports = connectDB;
