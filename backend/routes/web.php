<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\DocsController;

Route::get('/', [DocsController::class, 'index'])->name('home');

// Interactive API Documentation & Specs
Route::get('/docs', [DocsController::class, 'index'])->name('docs.index');
Route::get('/docs/openapi.json', [DocsController::class, 'openApiJson'])->name('docs.openapi');
Route::get('/docs/postman', [DocsController::class, 'postman'])->name('docs.postman');
