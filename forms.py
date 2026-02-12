from flask_wtf import FlaskForm
from wtforms import FloatField, StringField, PasswordField, SubmitField
from wtforms.validators import InputRequired, NumberRange, Length, EqualTo, Email, Optional

class RectangleForm(FlaskForm):
    length = FloatField('Length', validators=[InputRequired(), NumberRange(min=0)])
    width = FloatField('Width', validators=[InputRequired(), NumberRange(min=0)])
    area = SubmitField('Calculate Area')
    perimeter = SubmitField('Calculate Perimeter')

class SignupForm(FlaskForm):
    username = StringField('Username', validators=[InputRequired(), Length(min=3, max=50)])
    email = StringField('Email (optional)', validators=[Optional(), Email(), Length(max=120)])
    password = PasswordField('Password', validators=[InputRequired(), Length(min=6)])
    confirm_password = PasswordField(
        'Confirm Password',
        validators=[InputRequired(), EqualTo('password', message='Passwords must match.')]
    )
    admin_code = StringField('Admin Code (optional)')
    submit = SubmitField('Sign Up')

class LoginForm(FlaskForm):
    username = StringField('Username', validators=[InputRequired()])
    password = PasswordField('Password', validators=[InputRequired()])
    submit = SubmitField('Log In')

class WeatherReport(FlaskForm):
    city = StringField('City', validators=[InputRequired(), Length(min=2, max=100)])
    submit = SubmitField('Get Weather Report')
