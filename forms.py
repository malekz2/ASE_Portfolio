from flask_wtf import FlaskForm
from wtforms import FloatField, SubmitField
from wtforms.validators import InputRequired, NumberRange

class RectangleForm(FlaskForm):
    length = FloatField('Length', validators=[InputRequired(), NumberRange(min=0)])
    width = FloatField('Width', validators=[InputRequired(), NumberRange(min=0)])
    area = SubmitField('Calculate Area')
    perimeter = SubmitField('Calculate Perimeter')