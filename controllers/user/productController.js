const User = require("../../models/userModel");
const bcrypt = require("bcrypt");
const nodemailer = require('nodemailer');
const otpGenerator = require('otp-generator');
const Category = require('../../models/categoryModel');
const Product = require('../../models/productModel');
const Cart = require('../../models/cartModel');

const loadProductlist = async (req, res) => {
    try {
        const user = req.session.user;

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12; 

        const totalProducts = await Product.countDocuments({ isListed: true });

        const totalPages = Math.ceil(totalProducts / limit);

        const products = await Product.find({ isListed: true })
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        res.render('productslist', {
            products,
            user,
            currentPage: page,
            totalPages,
        });
    } catch (error) {
        console.log(error);
    }
};

const getProducts = async (req, res) => {
    try {
        const products = await Product.find({ isListed: true });
        res.render('productslist', { products });
    } catch (error) {
        console.error(error);
    }
};

const getProductDetails = async (req, res) => {
    try {
        const user = req.session.user

        const product = await Product.findOne({ _id: req.params.id, isListed: true });
        if (!product) {
            return res.status(404).render('error', { message: 'Product not found or not available' });
        }
        res.render('product', { product, user });
    } catch (error) {
        console.error(error);
    }
};

const addToCart = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: 'Please log in to add items to your cart' });
        }

        const { productId, quantity } = req.body;
        const userId = req.session.user._id;
        let cart = await Cart.findOne({ user: userId });

        if (!cart) {
            cart = new Cart({ user: userId, items: [] });
        }
        
        const existingItemIndex = cart.items.findIndex(item => item.product.toString() === productId);
        if (existingItemIndex > -1) {
            // Update quantity instead of adding
            cart.items[existingItemIndex].quantity = parseInt(quantity, 10);
        } else {
            cart.items.push({ product: productId, quantity: parseInt(quantity, 10) });
        }
        
        await cart.save();

        res.json({ success: true, message: 'Product added to cart successfully' });
    } catch (error) {
        console.error('Error adding product to cart:', error);
        res.status(500).json({ success: false, message: 'An error occurred while adding the product to cart' });
    }
};
const loadCart = async (req, res) => {
    try {

        if (!req.session.user) {
            return res.redirect('/login?message=' + encodeURIComponent('Please log in to view your cart'));
        }
        const userId = req.session.user._id;
        const cart = await Cart.findOne({ user: userId }).populate('items.product');

        res.render('cart', { user: req.session.user, cart });
    } catch (error) {
        console.error(error);
    }
};

const removeFromCart = async (req, res) => {
    try {
        const { productId } = req.body;
        const userId = req.session.user._id;

        const cart = await Cart.findOne({ user: userId });
        if (!cart) {
            return res.status(404).json({ success: false, message: 'Cart not found' });
        }

        cart.items = cart.items.filter(item => item.product.toString() !== productId);
        await cart.save();

        res.json({ success: true, message: 'Item removed from cart successfully' });
    } catch (error) {
        console.error('Error removing item from cart:', error);
        res.status(500).json({ success: false, message: 'An error occurred while removing the item from cart' });
    }
};

const updateCart =  async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: 'Please log in to update your cart' });
        }
  
        const { productId, quantity } = req.body;
        const userId = req.session.user._id;
  
        if (quantity <= 0) {
            return res.status(400).json({ success: false, message: 'Quantity must be greater than 0' });
        }
  
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }
  
        const productPrice = product.productPrice; 
  
        let cart = await Cart.findOne({ user: userId });
  
        if (!cart) {
            return res.status(404).json({ success: false, message: 'Cart not found' });
        }
  
        const itemIndex = cart.items.findIndex(item => item.product.toString() === productId);
  
        if (itemIndex > -1) {
            cart.items[itemIndex].quantity = quantity;
            cart.items[itemIndex].totalAmount = (quantity * productPrice).toFixed(2);
        } else {
            return res.status(404).json({ success: false, message: 'Item not found in cart' });
        }
  
        await cart.save();
  
        let cartSubtotal = 0;
        cart.items.forEach(item => {
            cartSubtotal += parseFloat(item.totalAmount);
        });
  
        res.json({
            success: true,
            message: 'Cart updated successfully',
            subtotal: cartSubtotal.toFixed(2),
            total: cartSubtotal.toFixed(2) 
        });
    } catch (error) {
        console.error('Error updating cart:', error);
        res.status(500).json({ success: false, message: 'An error occurred while updating the cart' });
    }
  };

  const loadSearch = async (req, res) => {
    try {
      const query = req.query.q.toLowerCase();
      const products = await Product.find({
        $or: [
          { productTitle: { $regex: query, $options: "i" } },
          { productDescription: { $regex: query, $options: "i" } }
        ],
        isListed: true,
      }).limit(10);
  
      const results = products.map((product) => ({
        id: product._id,
        name: product.productTitle,
        description: product.productDescription,
        price: product.productPrice,
        discountedPrice: product.productDiscountedPrice,
        image: product.productImages[0], 
      }));
  
      res.json(results);
    } catch (error) {
      console.error("Error in product search:", error);
      res.status(500).json({ error: "An error occurred while searching for products" });
    }
  }
module.exports = {
    getProductDetails,
    getProducts,
    loadProductlist,
    loadCart,
    addToCart,
    removeFromCart,
    updateCart,
    loadSearch
}