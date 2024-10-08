const Admin = require('../../models/adminModel');
const bcrypt = require('bcrypt');
const User = require("../../models/userModel");
const Product = require('../../models/productModel');
const Category = require('../../models/categoryModel');
const Order = require('../../models/orderModel');
const path = require('path');
const fs = require('fs');

const loadOrdersList = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const searchQuery = req.query.search || ''; 

    let query = {};
    if (searchQuery) {
      query = {
        $or: [
          { orderId: { $regex: searchQuery, $options: 'i' } }, 
          { 'userId.name': { $regex: searchQuery, $options: 'i' } }, 
          { 'items.order_status': { $regex: searchQuery, $options: 'i' } } 
        ]
      };
    }

    const totalOrders = await Order.countDocuments(query);
    const totalPages = Math.ceil(totalOrders / limit);

    const orders = await Order.find(query)
      .populate('userId')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const formattedOrders = orders.map(order => ({
      _id: order._id,
      orderId: order.orderId,
      createdAt: order.createdAt,
      status: order.items[0].order_status,
      userName: order.userId ? order.userId.name : 'Unknown User',
      cancelRequest: order.items.some(item => item.order_status === 'Cancellation Requested'),
      returnRequest: order.items.some(item => item.order_status === 'Return Requested'),
      items: order.items
    }));

    res.render('ordersList', {
      orders: formattedOrders,
      currentPage: page,
      totalPages: totalPages,
      totalOrders: totalOrders,
      searchQuery: searchQuery 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getOrderDetails = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const order = await Order.findById(orderId).populate('items.product');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    res.json({ success: true, order });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

const updateItemStatus = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const { status } = req.body;
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    const item = order.items.id(itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }
    item.order_status = status;
    await order.save();
    res.json({ success: true, message: 'Item status updated successfully', updatedOrder: order });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const acceptCancellationRequest = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    const item = order.items.id(itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }
    if (item.order_status !== 'Cancellation Requested') {
      return res.status(400).json({ success: false, message: 'Item is not in cancellation requested state' });
    }
    item.order_status = 'Cancelled';
    await order.save();
    res.json({ success: true, message: 'Item cancellation accepted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const acceptReturnRequest = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    const item = order.items.id(itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }
    if (item.order_status !== 'Return Requested') {
      return res.status(400).json({ success: false, message: 'Item is not in return requested state' });
    }
    item.order_status = 'Return Accepted';
    await order.save();
    res.json({ success: true, message: 'Item return accepted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
module.exports = {
  loadOrdersList,
  getOrderDetails,
  updateItemStatus,
  acceptCancellationRequest,
  acceptReturnRequest
}