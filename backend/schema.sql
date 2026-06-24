--
-- PostgreSQL database dump
--

-- Dumped from database version 16.4
-- Dumped by pg_dump version 16.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: schema; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA schema;


ALTER SCHEMA schema OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: crm_access; Type: TABLE; Schema: public; Owner: cir_user
--

CREATE TABLE public.crm_access (
    user_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.crm_access OWNER TO cir_user;

--
-- Name: crm_card_field_values; Type: TABLE; Schema: public; Owner: cir_user
--

CREATE TABLE public.crm_card_field_values (
    card_id integer NOT NULL,
    field_id integer NOT NULL,
    value text
);


ALTER TABLE public.crm_card_field_values OWNER TO cir_user;

--
-- Name: crm_card_files; Type: TABLE; Schema: public; Owner: cir_user
--

CREATE TABLE public.crm_card_files (
    id integer NOT NULL,
    card_id integer,
    field_id integer,
    file_name text NOT NULL,
    original_name text NOT NULL,
    file_size integer,
    uploaded_by integer,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.crm_card_files OWNER TO cir_user;

--
-- Name: crm_card_files_id_seq; Type: SEQUENCE; Schema: public; Owner: cir_user
--

CREATE SEQUENCE public.crm_card_files_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.crm_card_files_id_seq OWNER TO cir_user;

--
-- Name: crm_card_files_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: cir_user
--

ALTER SEQUENCE public.crm_card_files_id_seq OWNED BY public.crm_card_files.id;


--
-- Name: crm_card_participants; Type: TABLE; Schema: public; Owner: cir_user
--

CREATE TABLE public.crm_card_participants (
    card_id integer NOT NULL,
    user_id integer NOT NULL,
    added_by integer
);


ALTER TABLE public.crm_card_participants OWNER TO cir_user;

--
-- Name: crm_cards; Type: TABLE; Schema: public; Owner: cir_user
--

CREATE TABLE public.crm_cards (
    id integer NOT NULL,
    title character varying(500) NOT NULL,
    description text,
    column_id integer,
    sort_order integer DEFAULT 0,
    created_by integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.crm_cards OWNER TO cir_user;

--
-- Name: crm_cards_id_seq; Type: SEQUENCE; Schema: public; Owner: cir_user
--

CREATE SEQUENCE public.crm_cards_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.crm_cards_id_seq OWNER TO cir_user;

--
-- Name: crm_cards_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: cir_user
--

ALTER SEQUENCE public.crm_cards_id_seq OWNED BY public.crm_cards.id;


--
-- Name: crm_columns; Type: TABLE; Schema: public; Owner: cir_user
--

CREATE TABLE public.crm_columns (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.crm_columns OWNER TO cir_user;

--
-- Name: crm_columns_id_seq; Type: SEQUENCE; Schema: public; Owner: cir_user
--

CREATE SEQUENCE public.crm_columns_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.crm_columns_id_seq OWNER TO cir_user;

--
-- Name: crm_columns_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: cir_user
--

ALTER SEQUENCE public.crm_columns_id_seq OWNED BY public.crm_columns.id;


--
-- Name: crm_field_definitions; Type: TABLE; Schema: public; Owner: cir_user
--

CREATE TABLE public.crm_field_definitions (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    type character varying(50) NOT NULL,
    options jsonb,
    sort_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.crm_field_definitions OWNER TO cir_user;

--
-- Name: crm_field_definitions_id_seq; Type: SEQUENCE; Schema: public; Owner: cir_user
--

CREATE SEQUENCE public.crm_field_definitions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.crm_field_definitions_id_seq OWNER TO cir_user;

--
-- Name: crm_field_definitions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: cir_user
--

ALTER SEQUENCE public.crm_field_definitions_id_seq OWNED BY public.crm_field_definitions.id;


--
-- Name: event_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.event_log (
    id integer NOT NULL,
    user_id integer,
    action character varying(100) NOT NULL,
    entity_type character varying(100),
    entity_id integer,
    details jsonb,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.event_log OWNER TO postgres;

--
-- Name: event_log_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.event_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.event_log_id_seq OWNER TO postgres;

--
-- Name: event_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.event_log_id_seq OWNED BY public.event_log.id;


--
-- Name: orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.orders (
    id integer NOT NULL,
    order_number character varying(100) NOT NULL,
    product_name text NOT NULL,
    customer character varying(255),
    ship_date date,
    quantity integer DEFAULT 1,
    product_type character varying(50) DEFAULT 'Стандарт'::character varying,
    status character varying(50) DEFAULT 'Новый'::character varying,
    comment text,
    created_by integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.orders OWNER TO postgres;

--
-- Name: orders_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.orders_id_seq OWNER TO postgres;

--
-- Name: orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.orders_id_seq OWNED BY public.orders.id;


--
-- Name: production_orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.production_orders (
    id integer NOT NULL,
    narad_number character varying(100),
    status character varying(50) DEFAULT 'Новый'::character varying,
    order_number character varying(100),
    customer character varying(255),
    production_start_date date,
    operation_number character varying(20),
    is_final boolean DEFAULT false,
    product_name character varying(500),
    classifier_code character varying(255),
    object_type character varying(100),
    material_ready boolean DEFAULT false,
    pki_delivery_date date,
    material_grade character varying(255),
    assortment text,
    material_amount numeric(10,4),
    unit_of_measure character varying(50),
    operation_name character varying(255),
    machine_resource text,
    operation_comment text,
    quantity integer DEFAULT 1,
    priority integer DEFAULT 3,
    deadline timestamp with time zone,
    not_ready integer DEFAULT 0,
    ready integer DEFAULT 0,
    ready_to_process integer DEFAULT 0,
    defects integer DEFAULT 0,
    load_minutes numeric(10,2) DEFAULT 0,
    plan_minutes numeric(10,2) DEFAULT 0,
    fact_minutes numeric(10,2) DEFAULT 0,
    progress_pct numeric(5,2) DEFAULT 0,
    norm_time_hours numeric(8,3),
    load_per_unit_hours numeric(8,3),
    batch_prep_hours numeric(8,3),
    assembly_id character varying(255),
    serial_number integer,
    workshop_area character varying(255),
    executor character varying(255),
    program_ready_date date,
    is_cnc boolean DEFAULT false,
    request_numbers text,
    product_comment text,
    created_by integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    started_at timestamp with time zone,
    paused_at timestamp with time zone
);


ALTER TABLE public.production_orders OWNER TO postgres;

--
-- Name: production_orders_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.production_orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.production_orders_id_seq OWNER TO postgres;

--
-- Name: production_orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.production_orders_id_seq OWNED BY public.production_orders.id;


--
-- Name: products_archive; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.products_archive (
    id integer NOT NULL,
    assembly_id character varying(255),
    struct_id character varying(50) NOT NULL,
    item_name text NOT NULL,
    classifier character varying(255),
    quantity integer DEFAULT 1,
    object_type character varying(100),
    labor_hours numeric(8,3),
    parent_id character varying(50),
    level integer DEFAULT 0,
    created_by integer,
    created_at timestamp with time zone DEFAULT now(),
    serial_order integer
);


ALTER TABLE public.products_archive OWNER TO postgres;

--
-- Name: products_archive_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.products_archive_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.products_archive_id_seq OWNER TO postgres;

--
-- Name: products_archive_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.products_archive_id_seq OWNED BY public.products_archive.id;


--
-- Name: ref_coatings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ref_coatings (
    id integer NOT NULL,
    name character varying(255) NOT NULL
);


ALTER TABLE public.ref_coatings OWNER TO postgres;

--
-- Name: ref_coatings_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ref_coatings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ref_coatings_id_seq OWNER TO postgres;

--
-- Name: ref_coatings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ref_coatings_id_seq OWNED BY public.ref_coatings.id;


--
-- Name: ref_machines; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ref_machines (
    id integer NOT NULL,
    name text NOT NULL
);


ALTER TABLE public.ref_machines OWNER TO postgres;

--
-- Name: ref_machines_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ref_machines_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ref_machines_id_seq OWNER TO postgres;

--
-- Name: ref_machines_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ref_machines_id_seq OWNED BY public.ref_machines.id;


--
-- Name: ref_object_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ref_object_types (
    id integer NOT NULL,
    name character varying(100) NOT NULL
);


ALTER TABLE public.ref_object_types OWNER TO postgres;

--
-- Name: ref_object_types_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ref_object_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ref_object_types_id_seq OWNER TO postgres;

--
-- Name: ref_object_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ref_object_types_id_seq OWNED BY public.ref_object_types.id;


--
-- Name: ref_operations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ref_operations (
    id integer NOT NULL,
    name character varying(255) NOT NULL
);


ALTER TABLE public.ref_operations OWNER TO postgres;

--
-- Name: ref_operations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ref_operations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ref_operations_id_seq OWNER TO postgres;

--
-- Name: ref_operations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ref_operations_id_seq OWNED BY public.ref_operations.id;


--
-- Name: ref_units; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ref_units (
    id integer NOT NULL,
    name character varying(50) NOT NULL
);


ALTER TABLE public.ref_units OWNER TO postgres;

--
-- Name: ref_units_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ref_units_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ref_units_id_seq OWNER TO postgres;

--
-- Name: ref_units_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ref_units_id_seq OWNED BY public.ref_units.id;


--
-- Name: tech_operations_archive; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tech_operations_archive (
    id integer NOT NULL,
    classifier_code character varying(255) NOT NULL,
    product_name character varying(500) NOT NULL,
    notice_number character varying(100),
    object_type character varying(100),
    material_grade character varying(255),
    assortment text,
    material_amount numeric(10,4),
    unit_of_measure character varying(50),
    coating character varying(255),
    hardness character varying(100),
    full_name character varying(255),
    make_qty numeric(10,3),
    mass_kg numeric(10,4),
    dimensions character varying(255),
    main_order_id character varying(255),
    product_comment text,
    operation_number character varying(20) NOT NULL,
    operation_name character varying(255) NOT NULL,
    executor character varying(255),
    machine_resource text,
    operation_comment text,
    tool text,
    norm_time_hours numeric(8,3),
    batch_prep_hours numeric(8,3),
    load_per_unit_hours numeric(8,3),
    serial_number integer,
    is_outsourcing boolean DEFAULT false,
    is_final boolean DEFAULT false,
    is_cnc boolean DEFAULT false,
    created_by integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.tech_operations_archive OWNER TO postgres;

--
-- Name: tech_operations_archive_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tech_operations_archive_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tech_operations_archive_id_seq OWNER TO postgres;

--
-- Name: tech_operations_archive_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tech_operations_archive_id_seq OWNED BY public.tech_operations_archive.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    role character varying(50) DEFAULT 'technologist'::character varying NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    last_login timestamp with time zone
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: wh_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.wh_items (
    id integer NOT NULL,
    name text NOT NULL,
    material_type text,
    address text,
    unit text DEFAULT 'шт'::text,
    qty numeric(12,3) DEFAULT 0,
    min_qty numeric(12,3) DEFAULT 0,
    reserved numeric(12,3) DEFAULT 0,
    comments text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    sku character varying(9)
);


ALTER TABLE public.wh_items OWNER TO postgres;

--
-- Name: wh_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.wh_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.wh_items_id_seq OWNER TO postgres;

--
-- Name: wh_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.wh_items_id_seq OWNED BY public.wh_items.id;


--
-- Name: wh_mov_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.wh_mov_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.wh_mov_seq OWNER TO postgres;

--
-- Name: wh_movements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.wh_movements (
    id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    operation text NOT NULL,
    item_id integer,
    item_name text NOT NULL,
    qty numeric(12,3) NOT NULL,
    unit text,
    warehouse text,
    address text,
    supplier text,
    doc_number text,
    doc_date date,
    doc_type text,
    legal_entity text,
    request_ref text,
    order_ref text,
    comments text,
    created_by integer,
    mov_num character varying(9)
);


ALTER TABLE public.wh_movements OWNER TO postgres;

--
-- Name: wh_movements_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.wh_movements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.wh_movements_id_seq OWNER TO postgres;

--
-- Name: wh_movements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.wh_movements_id_seq OWNED BY public.wh_movements.id;


--
-- Name: wh_sku_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.wh_sku_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.wh_sku_seq OWNER TO postgres;

--
-- Name: work_orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.work_orders (
    id integer NOT NULL,
    narad_number character varying(100) NOT NULL,
    order_id integer,
    dse_name text,
    dse_code character varying(255),
    process_type character varying(100),
    machine text,
    operation_number character varying(20),
    is_final boolean DEFAULT false,
    norm_time_hours numeric(8,3),
    quantity integer DEFAULT 1,
    status character varying(50) DEFAULT 'Новый'::character varying,
    priority integer DEFAULT 3,
    start_date date,
    deadline date,
    not_ready integer DEFAULT 0,
    ready integer DEFAULT 0,
    defect integer DEFAULT 0,
    load_min numeric(8,2) DEFAULT 0,
    plan_min numeric(8,2) DEFAULT 0,
    fact_min numeric(8,2) DEFAULT 0,
    pct_done numeric(5,2) DEFAULT 0,
    comment text,
    responsible character varying(255),
    created_by integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.work_orders OWNER TO postgres;

--
-- Name: work_orders_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.work_orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.work_orders_id_seq OWNER TO postgres;

--
-- Name: work_orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.work_orders_id_seq OWNED BY public.work_orders.id;


--
-- Name: crm_card_files id; Type: DEFAULT; Schema: public; Owner: cir_user
--

ALTER TABLE ONLY public.crm_card_files ALTER COLUMN id SET DEFAULT nextval('public.crm_card_files_id_seq'::regclass);


--
-- Name: crm_cards id; Type: DEFAULT; Schema: public; Owner: cir_user
--

ALTER TABLE ONLY public.crm_cards ALTER COLUMN id SET DEFAULT nextval('public.crm_cards_id_seq'::regclass);


--
-- Name: crm_columns id; Type: DEFAULT; Schema: public; Owner: cir_user
--

ALTER TABLE ONLY public.crm_columns ALTER COLUMN id SET DEFAULT nextval('public.crm_columns_id_seq'::regclass);


--
-- Name: crm_field_definitions id; Type: DEFAULT; Schema: public; Owner: cir_user
--

ALTER TABLE ONLY public.crm_field_definitions ALTER COLUMN id SET DEFAULT nextval('public.crm_field_definitions_id_seq'::regclass);


--
-- Name: event_log id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.event_log ALTER COLUMN id SET DEFAULT nextval('public.event_log_id_seq'::regclass);


--
-- Name: orders id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders ALTER COLUMN id SET DEFAULT nextval('public.orders_id_seq'::regclass);


--
-- Name: production_orders id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.production_orders ALTER COLUMN id SET DEFAULT nextval('public.production_orders_id_seq'::regclass);


--
-- Name: products_archive id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products_archive ALTER COLUMN id SET DEFAULT nextval('public.products_archive_id_seq'::regclass);


--
-- Name: ref_coatings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ref_coatings ALTER COLUMN id SET DEFAULT nextval('public.ref_coatings_id_seq'::regclass);


--
-- Name: ref_machines id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ref_machines ALTER COLUMN id SET DEFAULT nextval('public.ref_machines_id_seq'::regclass);


--
-- Name: ref_object_types id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ref_object_types ALTER COLUMN id SET DEFAULT nextval('public.ref_object_types_id_seq'::regclass);


--
-- Name: ref_operations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ref_operations ALTER COLUMN id SET DEFAULT nextval('public.ref_operations_id_seq'::regclass);


--
-- Name: ref_units id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ref_units ALTER COLUMN id SET DEFAULT nextval('public.ref_units_id_seq'::regclass);


--
-- Name: tech_operations_archive id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tech_operations_archive ALTER COLUMN id SET DEFAULT nextval('public.tech_operations_archive_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: wh_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wh_items ALTER COLUMN id SET DEFAULT nextval('public.wh_items_id_seq'::regclass);


--
-- Name: wh_movements id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wh_movements ALTER COLUMN id SET DEFAULT nextval('public.wh_movements_id_seq'::regclass);


--
-- Name: work_orders id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_orders ALTER COLUMN id SET DEFAULT nextval('public.work_orders_id_seq'::regclass);


--
-- Name: crm_access crm_access_pkey; Type: CONSTRAINT; Schema: public; Owner: cir_user
--

ALTER TABLE ONLY public.crm_access
    ADD CONSTRAINT crm_access_pkey PRIMARY KEY (user_id);


--
-- Name: crm_card_field_values crm_card_field_values_pkey; Type: CONSTRAINT; Schema: public; Owner: cir_user
--

ALTER TABLE ONLY public.crm_card_field_values
    ADD CONSTRAINT crm_card_field_values_pkey PRIMARY KEY (card_id, field_id);


--
-- Name: crm_card_files crm_card_files_pkey; Type: CONSTRAINT; Schema: public; Owner: cir_user
--

ALTER TABLE ONLY public.crm_card_files
    ADD CONSTRAINT crm_card_files_pkey PRIMARY KEY (id);


--
-- Name: crm_card_participants crm_card_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: cir_user
--

ALTER TABLE ONLY public.crm_card_participants
    ADD CONSTRAINT crm_card_participants_pkey PRIMARY KEY (card_id, user_id);


--
-- Name: crm_cards crm_cards_pkey; Type: CONSTRAINT; Schema: public; Owner: cir_user
--

ALTER TABLE ONLY public.crm_cards
    ADD CONSTRAINT crm_cards_pkey PRIMARY KEY (id);


--
-- Name: crm_columns crm_columns_pkey; Type: CONSTRAINT; Schema: public; Owner: cir_user
--

ALTER TABLE ONLY public.crm_columns
    ADD CONSTRAINT crm_columns_pkey PRIMARY KEY (id);


--
-- Name: crm_field_definitions crm_field_definitions_pkey; Type: CONSTRAINT; Schema: public; Owner: cir_user
--

ALTER TABLE ONLY public.crm_field_definitions
    ADD CONSTRAINT crm_field_definitions_pkey PRIMARY KEY (id);


--
-- Name: event_log event_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.event_log
    ADD CONSTRAINT event_log_pkey PRIMARY KEY (id);


--
-- Name: orders orders_order_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_order_number_key UNIQUE (order_number);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: production_orders production_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.production_orders
    ADD CONSTRAINT production_orders_pkey PRIMARY KEY (id);


--
-- Name: products_archive products_archive_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products_archive
    ADD CONSTRAINT products_archive_pkey PRIMARY KEY (id);


--
-- Name: ref_coatings ref_coatings_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ref_coatings
    ADD CONSTRAINT ref_coatings_name_key UNIQUE (name);


--
-- Name: ref_coatings ref_coatings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ref_coatings
    ADD CONSTRAINT ref_coatings_pkey PRIMARY KEY (id);


--
-- Name: ref_machines ref_machines_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ref_machines
    ADD CONSTRAINT ref_machines_name_key UNIQUE (name);


--
-- Name: ref_machines ref_machines_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ref_machines
    ADD CONSTRAINT ref_machines_pkey PRIMARY KEY (id);


--
-- Name: ref_object_types ref_object_types_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ref_object_types
    ADD CONSTRAINT ref_object_types_name_key UNIQUE (name);


--
-- Name: ref_object_types ref_object_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ref_object_types
    ADD CONSTRAINT ref_object_types_pkey PRIMARY KEY (id);


--
-- Name: ref_operations ref_operations_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ref_operations
    ADD CONSTRAINT ref_operations_name_key UNIQUE (name);


--
-- Name: ref_operations ref_operations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ref_operations
    ADD CONSTRAINT ref_operations_pkey PRIMARY KEY (id);


--
-- Name: ref_units ref_units_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ref_units
    ADD CONSTRAINT ref_units_name_key UNIQUE (name);


--
-- Name: ref_units ref_units_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ref_units
    ADD CONSTRAINT ref_units_pkey PRIMARY KEY (id);


--
-- Name: tech_operations_archive tech_operations_archive_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tech_operations_archive
    ADD CONSTRAINT tech_operations_archive_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: wh_items wh_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wh_items
    ADD CONSTRAINT wh_items_pkey PRIMARY KEY (id);


--
-- Name: wh_items wh_items_sku_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wh_items
    ADD CONSTRAINT wh_items_sku_unique UNIQUE (sku);


--
-- Name: wh_movements wh_movements_mov_num_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wh_movements
    ADD CONSTRAINT wh_movements_mov_num_unique UNIQUE (mov_num);


--
-- Name: wh_movements wh_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wh_movements
    ADD CONSTRAINT wh_movements_pkey PRIMARY KEY (id);


--
-- Name: work_orders work_orders_narad_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_narad_number_key UNIQUE (narad_number);


--
-- Name: work_orders work_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_pkey PRIMARY KEY (id);


--
-- Name: idx_production_started_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_production_started_at ON public.production_orders USING btree (started_at) WHERE (started_at IS NOT NULL);


--
-- Name: wh_movements_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX wh_movements_created_at_idx ON public.wh_movements USING btree (created_at);


--
-- Name: wh_movements_item_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX wh_movements_item_id_idx ON public.wh_movements USING btree (item_id);


--
-- Name: crm_access crm_access_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cir_user
--

ALTER TABLE ONLY public.crm_access
    ADD CONSTRAINT crm_access_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: crm_card_field_values crm_card_field_values_card_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cir_user
--

ALTER TABLE ONLY public.crm_card_field_values
    ADD CONSTRAINT crm_card_field_values_card_id_fkey FOREIGN KEY (card_id) REFERENCES public.crm_cards(id) ON DELETE CASCADE;


--
-- Name: crm_card_field_values crm_card_field_values_field_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cir_user
--

ALTER TABLE ONLY public.crm_card_field_values
    ADD CONSTRAINT crm_card_field_values_field_id_fkey FOREIGN KEY (field_id) REFERENCES public.crm_field_definitions(id) ON DELETE CASCADE;


--
-- Name: crm_card_files crm_card_files_card_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cir_user
--

ALTER TABLE ONLY public.crm_card_files
    ADD CONSTRAINT crm_card_files_card_id_fkey FOREIGN KEY (card_id) REFERENCES public.crm_cards(id) ON DELETE CASCADE;


--
-- Name: crm_card_files crm_card_files_field_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cir_user
--

ALTER TABLE ONLY public.crm_card_files
    ADD CONSTRAINT crm_card_files_field_id_fkey FOREIGN KEY (field_id) REFERENCES public.crm_field_definitions(id);


--
-- Name: crm_card_files crm_card_files_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cir_user
--

ALTER TABLE ONLY public.crm_card_files
    ADD CONSTRAINT crm_card_files_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- Name: crm_card_participants crm_card_participants_added_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cir_user
--

ALTER TABLE ONLY public.crm_card_participants
    ADD CONSTRAINT crm_card_participants_added_by_fkey FOREIGN KEY (added_by) REFERENCES public.users(id);


--
-- Name: crm_card_participants crm_card_participants_card_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cir_user
--

ALTER TABLE ONLY public.crm_card_participants
    ADD CONSTRAINT crm_card_participants_card_id_fkey FOREIGN KEY (card_id) REFERENCES public.crm_cards(id) ON DELETE CASCADE;


--
-- Name: crm_card_participants crm_card_participants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cir_user
--

ALTER TABLE ONLY public.crm_card_participants
    ADD CONSTRAINT crm_card_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: crm_cards crm_cards_column_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cir_user
--

ALTER TABLE ONLY public.crm_cards
    ADD CONSTRAINT crm_cards_column_id_fkey FOREIGN KEY (column_id) REFERENCES public.crm_columns(id);


--
-- Name: crm_cards crm_cards_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cir_user
--

ALTER TABLE ONLY public.crm_cards
    ADD CONSTRAINT crm_cards_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: event_log event_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.event_log
    ADD CONSTRAINT event_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: orders orders_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: production_orders production_orders_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.production_orders
    ADD CONSTRAINT production_orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: products_archive products_archive_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products_archive
    ADD CONSTRAINT products_archive_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: tech_operations_archive tech_operations_archive_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tech_operations_archive
    ADD CONSTRAINT tech_operations_archive_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: wh_movements wh_movements_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wh_movements
    ADD CONSTRAINT wh_movements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: wh_movements wh_movements_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wh_movements
    ADD CONSTRAINT wh_movements_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.wh_items(id) ON DELETE SET NULL;


--
-- Name: work_orders work_orders_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: work_orders work_orders_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: TABLE event_log; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.event_log TO cir_user;


--
-- Name: SEQUENCE event_log_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.event_log_id_seq TO cir_user;


--
-- Name: TABLE orders; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.orders TO cir_user;


--
-- Name: SEQUENCE orders_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.orders_id_seq TO cir_user;


--
-- Name: TABLE production_orders; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.production_orders TO cir_user;


--
-- Name: SEQUENCE production_orders_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.production_orders_id_seq TO cir_user;


--
-- Name: TABLE products_archive; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.products_archive TO cir_user;


--
-- Name: SEQUENCE products_archive_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.products_archive_id_seq TO cir_user;


--
-- Name: TABLE ref_coatings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.ref_coatings TO cir_user;


--
-- Name: SEQUENCE ref_coatings_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.ref_coatings_id_seq TO cir_user;


--
-- Name: TABLE ref_machines; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.ref_machines TO cir_user;


--
-- Name: SEQUENCE ref_machines_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.ref_machines_id_seq TO cir_user;


--
-- Name: TABLE ref_object_types; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.ref_object_types TO cir_user;


--
-- Name: SEQUENCE ref_object_types_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.ref_object_types_id_seq TO cir_user;


--
-- Name: TABLE ref_operations; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.ref_operations TO cir_user;


--
-- Name: SEQUENCE ref_operations_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.ref_operations_id_seq TO cir_user;


--
-- Name: TABLE ref_units; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.ref_units TO cir_user;


--
-- Name: SEQUENCE ref_units_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.ref_units_id_seq TO cir_user;


--
-- Name: TABLE tech_operations_archive; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.tech_operations_archive TO cir_user;


--
-- Name: SEQUENCE tech_operations_archive_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.tech_operations_archive_id_seq TO cir_user;


--
-- Name: TABLE users; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.users TO cir_user;


--
-- Name: SEQUENCE users_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.users_id_seq TO cir_user;


--
-- Name: TABLE wh_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.wh_items TO cir_user;


--
-- Name: SEQUENCE wh_items_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.wh_items_id_seq TO cir_user;


--
-- Name: SEQUENCE wh_mov_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.wh_mov_seq TO cir_user;


--
-- Name: TABLE wh_movements; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.wh_movements TO cir_user;


--
-- Name: SEQUENCE wh_movements_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.wh_movements_id_seq TO cir_user;


--
-- Name: SEQUENCE wh_sku_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.wh_sku_seq TO cir_user;


--
-- Name: TABLE work_orders; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.work_orders TO cir_user;


--
-- Name: SEQUENCE work_orders_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.work_orders_id_seq TO cir_user;


--
-- PostgreSQL database dump complete
--

