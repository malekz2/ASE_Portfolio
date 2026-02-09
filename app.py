from flask import Flask, render_template, request
from forms import RectangleForm
app = Flask(__name__)
app.config['SECRET_KEY'] = 'dev-secret-key-change-in-production'  # Add this line

@app.route('/') #the home page
def home():
    return render_template('index.html')
@app.route('/about')
def about():
    return render_template("about.html")
@app.route('/projects')
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
            perimeter = 2*(length + width)

    return render_template("rectangle.html", form=form, area=area, perimeter=perimeter)


if __name__ == '__main__':
    app.run(debug=True, port=5000)