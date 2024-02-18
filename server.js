require('dotenv').config();
const express = require('express');
const mysql = require('mysql');
const path = require('path');
const session = require('express-session');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');

const port = 1707;

const app = express();
app.use(cookieParser());
app.set("view engine", "ejs");
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use('/static', express.static(path.join(__dirname, 'static')));
// Parse JSON bodies
app.use(bodyParser.json());

const server = app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running on port ${port}`);
});

const connection = mysql.createPool({
    host: process.env.MYSQL_HOSTNAME,
    port: process.env.MYSQL_PORT,
    user: process.env.MYSQL_USERNAME,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DB,  
});

const sessionMiddleware = session({
    secret: 'SessionSecretKey',
    resave: false,
    saveUninitialized: true,
});

const isAuthenticated = (req, res, next) => {
    if (req.cookies.isAuthenticated) {
        next();
    }
    else {
        res.redirect('/');
    }
};


app.get('/', async (req, res) => {
    try {
        await connection.query(`
            CREATE TABLE IF NOT EXISTS tb_incomeExpense (id INT PRIMARY KEY AUTO_INCREMENT, date DATE,
                category VARCHAR(60), detail VARCHAR(100), price INT, remark VARCHAR(200))
        `, (err, results) => {
            if (err) {
                console.log(err);
                res.send(err);
            } else {
                console.log("CREATE oncomeExpense TABLE SUCCESSFULL");
            }
        });

        await connection.query(`
            CREATE TABLE IF NOT EXISTS tb_users (id INT PRIMARY KEY AUTO_INCREMENT, username VARCHAR(50),
                password VARCHAR(50))
        `, (err, results) => {
            if (err) {
                console.log(err);
                res.send(err);
            } else {
                console.log("CREATE users TABLE SUCCESSFULL");
            }
        });

        // await connection.query(`
        //     INSERT INTO tb_users (username, password) VALUES ('milin', 'milin1707');
        // `, (err, results) => {
        //     if (err) {
        //         console.log(err);
        //         res.send(err);
        //     } else {
        //         console.log("INSERT users TABLE SUCCESSFULL");
        //     }
        // });

        res.render('home');

    } catch (error) {
        console.error("Error : ", error);
        res.status(500);
    }
});
app.post('/login', async (req, res) => {
    try {
        const username = req.body.username;
        const password = req.body.password;
        const user_exists = await new Promise((resolve, reject) => {
            connection.query(`
                SELECT * FROM tb_users WHERE
                username = ? AND password = ?
            `, [username, password], (err, results) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(results);
                }
            })
        })

        if (!user_exists.length) {
            res.redirect('/');
        } else {
            res.redirect('/main_page');
        }

    } catch (error) {
        console.error("Error : ", error);
        res.status(500);
    }
});

app.get('/main_page', isAuthenticated, async (req, res) => {
    try {

        res.render('main_page');

    } catch (error) {
        console.error("Error : ", error);
        res.status(500);
    }
})




app.get('/logout', (req, res) => {
    res.clearCookie('isAuthenticated'); // Clear the isAuthenticated cookie

    
    res.redirect('/');
});