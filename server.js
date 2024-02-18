require('dotenv').config();
const express = require('express');
const mysql = require('mysql');
const path = require('path');
const session = require('express-session');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');

const port = 1707;

const app = express();

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

app.use(cookieParser());
app.use(sessionMiddleware); // Add this line before defining routes

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
        });

        console.log(user_exists);


        if (!user_exists.length) {
            
            console.log('No user');
            res.redirect('/');
        } else {
            req.session.isAuthenticated = true;
            res.cookie('isAuthenticated', true);
            console.log('Have user');
            res.redirect('/main_page');
        }

    } catch (error) {
        console.error("Error : ", error);
        res.status(500);
    }
});

app.get('/main_page', isAuthenticated, async (req, res) => {
    try {
        let filter_state = req.query.filter_state;
        let start_date = req.query.start_date;
        let end_date = req.query.end_date;
        const currentDate = new Date().toISOString().split('T')[0];

        if (!filter_state) {
            filter_state = '0';
        }
        console.log("Filter SUBMIT", filter_state);

        let get_all_datas = [];
        let get_sum = [];
        if (filter_state === '0') {
            get_all_datas = await new Promise((resolve, reject) => {
                connection.query(`
                    SELECT * FROM tb_incomeExpense WHERE date = ?
                    ORDER BY date
                `, [currentDate], (err, results) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(results);
                    }
                })
            });

            get_sum = await new Promise((resolve, reject) => {
                connection.query(`
                    SELECT SUM(price) AS sum FROM tb_incomeExpense WHERE date = ?
                    ORDER BY date
                `, [currentDate], (err, results) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(results);
                    }
                })
            });

            get_sum_category = await new Promise((resolve, reject) => {
                connection.query(`
                    SELECT SUM(price) AS sum, category FROM tb_incomeExpense WHERE date = ?
                    GROUP BY category
                    ORDER BY date
                `, [currentDate], (err, results) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(results);
                    }
                })
            });
        } else {
            get_all_datas = await new Promise((resolve, reject) => {
                connection.query(`
                    SELECT * FROM tb_incomeExpense
                    WHERE date <= ? AND date >= ?
                    ORDER BY date
                `, [end_date, start_date], (err, results) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(results);
                    }
                })
            });

            get_sum = await new Promise((resolve, reject) => {
                connection.query(`
                    SELECT SUM(price) AS sum FROM tb_incomeExpense
                    WHERE date <= ? AND date >= ?
                    ORDER BY date
                `, [end_date, start_date], (err, results) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(results);
                    }
                })
            });

            get_sum_category = await new Promise((resolve, reject) => {
                connection.query(`
                    SELECT SUM(price) AS sum, category FROM tb_incomeExpense
                    WHERE date <= ? AND date >= ?
                    GROUP BY category
                    ORDER BY date
                `, [end_date, start_date], (err, results) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(results);
                    }
                })
            });
        }

        // const priceData = JSON.stringify(get_all_datas.map(data => data.price));
        // const categoryData = JSON.stringify(get_all_datas.map(data => data.category));
        // Creating unique categories and calculating total price for each category


        // console.log("PRICE datas : ", priceData);
        // console.log("CATEGORY datas : ", categoryData);
        res.render('main_page', {get_all_datas, start_date, end_date, get_sum, get_sum_category});

    } catch (error) {
        console.error("Error : ", error);
        res.status(500);
    }
});
app.post('/main_page/filter', async (req, res) => {
    try {
        const selected_start_date = req.body.selected_start_date;
        const selected_end_date = req.body.selected_end_date;
        
        res.redirect(`/main_page?filter_state='1'&start_date=${selected_start_date}&end_date=${selected_end_date}`);

    } catch (error) {
        console.error("Error : ", error);
        res.status(500);
    }
});
app.post('/main_page/submit', async (req, res) => {
    try {
        const date = req.body.date;
        const category = req.body.category;
        const detail = req.body.detail;
        const price = parseInt(req.body.price);
        const remark = req.body.remark;

        console.log(detail);

        const save_datas = await new Promise((resolve, reject) => {
            connection.query(`
                INSERT INTO tb_incomeExpense (date, category, detail, price, remark)
                VALUES (?, ?, ?, ?, ?)
            `, [date, category, detail, price, remark], (err, results) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(results);
                    console.log("Save Data Successfully");
                    res.redirect('/main_page');
                }
            });
        });

    } catch (error) {
        console.error("Error : ", error);
        res.status(500);
    }
});
app.get('/main_page/delete', isAuthenticated, async (req, res) => {
    try {
        const id = parseInt(req.query.id);

        console.log(id);

        await connection.query(`
            DELETE FROM tb_incomeExpense WHERE id = ?
        `, [id], (err, results) => {
            if (err) {
                console.log(err);
                res.send(err);
            } else {
                console.log("DELETE data successfully for id = ", id);
                res.redirect('/main_page');
            }
        });



    } catch (error) {
        console.error("Error : ", error);
        res.status(500);
    }
})




app.get('/logout', (req, res) => {
    res.clearCookie('isAuthenticated'); // Clear the isAuthenticated cookie

    
    res.redirect('/');
});