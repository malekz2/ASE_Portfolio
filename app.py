import requests
from flask import Flask, render_template, request, redirect, url_for, flash, session
from models import db, User
from forms import RectangleForm, LoginForm, SignupForm, WeatherReport
from functools import wraps

app = Flask(__name__)
app.config['SECRET_KEY'] = 'dev-secret-key-change-in-production'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///app.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Admin code for creating admin accounts (change this to your preferred code)
ADMIN_CODE = 'admin123'

db.init_app(app)

# Create database tables
with app.app_context():
    db.create_all()


# Decorator for login required routes
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            flash('Please log in to access that page.', 'warning')
            return redirect(url_for('login'))
        return f(*args, **kwargs)

    return decorated_function


# Decorator for admin-only routes
def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            flash('Please log in to access that page.', 'warning')
            return redirect(url_for('login'))
        if session.get('role') != 'admin':
            flash('Admin access only.', 'danger')
            return redirect(url_for('home'))
        return f(*args, **kwargs)

    return decorated_function


@app.route('/')
def home():
    return render_template('index.html')


@app.route('/about')
def about():
    return render_template("about.html")


@app.route('/projects')
@login_required  # Projects page is now protected - login required
def projects():
    return render_template("projects.html")


@app.route('/rectangle', methods=['GET', 'POST'])
def rectangle():
    form = RectangleForm()
    area = None
    perimeter = None
    if form.validate_on_submit():
        length = form.length.data
        width = form.width.data

        if form.area.data:
            area = width * length
        elif form.perimeter.data:
            perimeter = 2 * (length + width)

    return render_template("rectangle.html", form=form, area=area, perimeter=perimeter)

@app.route('/weatherreport', methods=['GET', 'POST'])
def weather():
    form = WeatherReport()

    weather_data = None
    error = None

    if form.validate_on_submit():
        city = form.city.data.strip()

        # 1) City -> (lat, lon) using Nominatim
        geo_url = "https://nominatim.openstreetmap.org/search"
        geo_params = {"q": city, "format": "json", "limit": 1}
        geo_headers = {"User-Agent": "ASE-Flask-Student-Project (school use)"}

        geo_resp = requests.get(geo_url, params=geo_params, headers=geo_headers, timeout=10)
        geo_results = geo_resp.json()

        if not geo_results:
            error = "City not found. Please try another spelling."
            return render_template("weather.html", form=form, weather_data=weather_data, error=error)

        lat = float(geo_results[0]["lat"])
        lon = float(geo_results[0]["lon"])

        # 2) (lat, lon) -> current weather using Open-Meteo
        weather_url = "https://api.open-meteo.com/v1/forecast"
        weather_params = {
            "latitude": lat,
            "longitude": lon,
            "current_weather": True
        }

        w_resp = requests.get(weather_url, params=weather_params, timeout=10)
        w_json = w_resp.json()

        if "current_weather" not in w_json:
            error = "Weather data is unavailable right now. Try again later."
        else:
            cw = w_json["current_weather"]
            weather_data = {
                "city": city,
                "temperature": cw.get("temperature"),
                "windspeed": cw.get("windspeed"),
                "winddirection": cw.get("winddirection"),
                "time": cw.get("time")
            }

    return render_template("weather.html", form=form, weather_data=weather_data, error=error)


@app.route('/register', methods=['GET', 'POST'])
def register():
    form = SignupForm()

    if form.validate_on_submit():
        username = form.username.data
        email = form.email.data if form.email.data else None
        password = form.password.data
        admin_code = form.admin_code.data

        # Check if username already exists
        if User.query.filter_by(username=username).first():
            flash('Username already exists. Please choose a different one.', 'danger')
            return render_template('register.html', form=form)

        # Check if email already exists (if provided)
        if email and User.query.filter_by(email=email).first():
            flash('Email already registered. Please use a different one.', 'danger')
            return render_template('register.html', form=form)

        # Determine role: first user becomes admin, or if admin code is correct
        user_count = User.query.count()
        if user_count == 0:
            # First user is automatically admin
            role = 'admin'
            flash('Congratulations! You are the first user and have been granted admin privileges.', 'success')
        elif admin_code == ADMIN_CODE:
            # Valid admin code provided
            role = 'admin'
            flash('Admin code accepted. You have been granted admin privileges.', 'success')
        else:
            role = 'user'

        # Create new user
        new_user = User(username=username, email=email, role=role)
        new_user.set_password(password)

        db.session.add(new_user)
        db.session.commit()

        flash(f'Account created successfully! You can now log in.', 'success')
        return redirect(url_for('login'))

    return render_template('register.html', form=form)


@app.route('/login', methods=['GET', 'POST'])
def login():
    form = LoginForm()

    if form.validate_on_submit():
        username = form.username.data
        password = form.password.data

        user = User.query.filter_by(username=username).first()

        # Check if user exists and password is correct
        if not user or not user.check_password(password):
            flash('Invalid username or password.', 'danger')
            return render_template('login.html', form=form)

        # Check if user account is active
        if not user.is_active:
            flash('Your account has been deactivated. Please contact an administrator.', 'danger')
            return render_template('login.html', form=form)

        # Login successful - create session
        session['user_id'] = user.id
        session['username'] = user.username
        session['role'] = user.role

        flash(f'Welcome back, {user.username}!', 'success')

        # Redirect to projects page (or admin if admin)
        if user.role == 'admin':
            return redirect(url_for('admin'))
        return redirect(url_for('projects'))

    return render_template('login.html', form=form)


@app.route('/logout')
def logout():
    session.clear()
    flash('You have been logged out.', 'info')
    return redirect(url_for('home'))


@app.route('/admin')
@admin_required
def admin():
    users = User.query.order_by(User.created_at.desc()).all()
    return render_template('admin.html', users=users)


@app.route('/admin/toggle/<int:user_id>', methods=['POST'])
@admin_required
def toggle_user(user_id):
    user = User.query.get_or_404(user_id)

    # Safety: admin cannot deactivate themselves
    if user.id == session.get('user_id'):
        flash('You cannot deactivate your own account.', 'danger')
        return redirect(url_for('admin'))

    user.is_active = not user.is_active
    db.session.commit()

    status = "activated" if user.is_active else "deactivated"
    flash(f'User {user.username} has been {status}.', 'success')
    return redirect(url_for('admin'))


@app.route('/admin/delete/<int:user_id>', methods=['POST'])
@admin_required
def delete_user(user_id):
    user = User.query.get_or_404(user_id)

    # Safety: admin cannot delete themselves
    if user.id == session.get('user_id'):
        flash('You cannot delete your own account.', 'danger')
        return redirect(url_for('admin'))

    username = user.username
    db.session.delete(user)
    db.session.commit()

    flash(f'User {username} has been deleted.', 'info')
    return redirect(url_for('admin'))


if __name__ == '__main__':
    app.run(debug=True, port=5000)