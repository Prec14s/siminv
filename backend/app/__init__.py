import os
import click
from flask import Flask, jsonify, send_from_directory
from .config import Config, BASE_DIR
from .extensions import db, migrate, jwt, cors
from .models import User, TokenBlocklist
from .utils import ApiError, fail

from .routes.auth import bp as auth_bp
from .routes.users import bp as users_bp
from .routes.master import bp as master_bp
from .routes.items import bp as items_bp
from .routes.requests import bp as requests_bp
from .routes.transactions import bp as transactions_bp
from .routes.reports import bp as reports_bp
from .routes.dashboard import bp as dashboard_bp
from .routes.misc import bp as misc_bp


def create_app(config_class=Config):
    app = Flask(__name__, static_folder=os.path.join(BASE_DIR, "uploads"))
    app.config.from_object(config_class)

    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    cors.init_app(app, origins=app.config.get("CORS_ORIGINS", ["*"]))

    # Ensure upload folder exists
    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

    # JWT handlers
    @jwt.user_lookup_loader
    def user_lookup_callback(_jwt_header, jwt_data):
        identity = jwt_data["sub"]
        return db.session.get(User, int(identity))

    @jwt.token_in_blocklist_loader
    def check_if_token_revoked(_jwt_header, jwt_data):
        jti = jwt_data["jti"]
        token = db.session.query(TokenBlocklist.id).filter_by(jti=jti).scalar()
        return token is not None

    # Error handlers
    @app.errorhandler(ApiError)
    def handle_api_error(err):
        return fail(err.message, err.status, err.errors)

    @app.errorhandler(404)
    def handle_404(e):
        return fail("Endpoint tidak ditemukan", 404)

    @app.errorhandler(500)
    def handle_500(e):
        return fail("Terjadi kesalahan pada server", 500)

    # Health check route
    @app.get("/api/v1/health")
    def health_check():
        return jsonify({"success": True, "message": "SIMINV API v1.0 running", "status": "ok"})

    # Static uploads endpoint
    @app.get("/uploads/<path:filename>")
    def uploaded_file(filename):
        return send_from_directory(app.config["UPLOAD_FOLDER"], filename)

    # Register Blueprints
    prefix = "/api/v1"
    app.register_blueprint(auth_bp, url_prefix=prefix)
    app.register_blueprint(users_bp, url_prefix=prefix)
    app.register_blueprint(master_bp, url_prefix=prefix)
    app.register_blueprint(items_bp, url_prefix=prefix)
    app.register_blueprint(requests_bp, url_prefix=prefix)
    app.register_blueprint(transactions_bp, url_prefix=prefix)
    app.register_blueprint(reports_bp, url_prefix=prefix)
    app.register_blueprint(dashboard_bp, url_prefix=prefix)
    app.register_blueprint(misc_bp, url_prefix=prefix)

    # CLI Commands
    @app.cli.command("seed")
    @click.option("--no-demo", is_flag=True, help="Jangan buat data barang & supplier contoh")
    def seed_command(no_demo):
        """Isi database dengan data awal / contoh."""
        from .seed import run_seed
        run_seed(demo=not no_demo)
        click.echo("Seeding selesai.")

    @app.cli.command("create-superadmin")
    def create_superadmin():
        """Buat akun Super Admin baru."""
        name = click.prompt("Nama Lengkap")
        username = click.prompt("Username")
        email = click.prompt("Email")
        password = click.prompt("Password", hide_input=True, confirmation_prompt=True)

        if User.query.filter((User.username == username) | (User.email == email)).first():
            click.echo("Error: Username atau Email sudah digunakan.")
            return

        u = User()
        u.name = name
        u.username = username
        u.email = email
        u.role = "super_admin"
        u.set_password(password)
        db.session.add(u)
        db.session.commit()
        click.echo(f"Super Admin {username} berhasil dibuat.")

    @app.cli.command("gen-secrets")
    def gen_secrets():
        """Generate random SECRET_KEY dan JWT_SECRET_KEY ke file .env."""
        import secrets
        env_path = os.path.join(BASE_DIR, ".env")
        secret_key = secrets.token_hex(32)
        jwt_secret_key = secrets.token_hex(32)

        if not os.path.exists(env_path):
            click.echo("File .env tidak ditemukan, membuat baru dari .env.example...")
            example_path = os.path.join(BASE_DIR, ".env.example")
            if os.path.exists(example_path):
                with open(example_path, "r", encoding="utf-8") as f:
                    content = f.read()
            else:
                content = ""
        else:
            with open(env_path, "r", encoding="utf-8") as f:
                content = f.read()

        new_lines = []
        has_secret = False
        has_jwt = False
        for line in content.splitlines():
            if line.startswith("SECRET_KEY="):
                new_lines.append(f"SECRET_KEY={secret_key}")
                has_secret = True
            elif line.startswith("JWT_SECRET_KEY="):
                new_lines.append(f"JWT_SECRET_KEY={jwt_secret_key}")
                has_jwt = True
            else:
                new_lines.append(line)

        if not has_secret:
            new_lines.append(f"SECRET_KEY={secret_key}")
        if not has_jwt:
            new_lines.append(f"JWT_SECRET_KEY={jwt_secret_key}")

        with open(env_path, "w", encoding="utf-8") as f:
            f.write("\n".join(new_lines) + "\n")

        click.echo("SUCCESS: SECRET_KEY & JWT_SECRET_KEY otomatis diperbarui di .env!")

    return app
