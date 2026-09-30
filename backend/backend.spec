# -*- mode: python ; coding: utf-8 -*-
import sys
import os
from PyInstaller.utils.hooks import collect_data_files, collect_submodules

block_cipher = None

# Collect all dynamic imports from ReportLab and OpenPyXL
datas = collect_data_files('reportlab') + collect_data_files('openpyxl')

hiddenimports = (
    collect_submodules('uvicorn') +
    collect_submodules('fastapi') +
    collect_submodules('starlette') +
    collect_submodules('sqlalchemy') +
    collect_submodules('reportlab') +
    collect_submodules('openpyxl') +
    collect_submodules('pydantic') +
    collect_submodules('pydantic_settings') +
    [
        'multipart',
        'email_validator',
        'jose',
        'passlib',
        'bcrypt',
        'app.api.v1.api',
        'app.api.v1.endpoints.auth',
        'app.api.v1.endpoints.customers',
        'app.api.v1.endpoints.vehicles',
        'app.api.v1.endpoints.job_cards',
        'app.api.v1.endpoints.invoices',
        'app.api.v1.endpoints.catalogs',
        'app.api.v1.endpoints.reports',
        'app.api.v1.endpoints.settings',
        'app.api.v1.endpoints.backup',
        'app.api.v1.endpoints.search',
    ]
)

a = Analysis(
    ['server_entrypoint.py'],
    pathex=['.'],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    runtime_hooks=[],
    excludes=['tkinter', 'matplotlib', 'notebook', 'scipy'],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='backend-server',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,
    icon='../desktop/assets/icon.ico',
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name='backend-server',
)
